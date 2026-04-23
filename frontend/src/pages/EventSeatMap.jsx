import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getEvent, getEventSeats, createCheckoutSession } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSeatLocking } from '../hooks/useSeatLocking'
import useSeatStore from '../store/seatStore'
import { Seat } from '../components/Seat'
import { SelectedSeatsSidebar } from '../components/SelectedSeatsSidebar'
import { ConnectionStatus } from '../components/ConnectionStatus'

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T']

export default function EventSeatMap({ user }) {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')

  const {
    seats, setAllSeats, updateSeatStatus, setMyLocks,
    batchUpdateSeats, resetSeats, isSeatMine, myLocks
  } = useSeatStore()

  const { handleSeatClick, isPending } = useSeatLocking(Number(eventId))
  const eventRef = useRef(null)

  // ── WebSocket message handler ────────────────────────────
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'initial_state':
        batchUpdateSeats(msg.seats)
        if (msg.user_locks) setMyLocks(msg.user_locks)
        break

      case 'seat_booked': {
        updateSeatStatus(msg.seat_id, 'booked', null)
        break
      }


      case 'seat_locked': {
        const isMe = user && msg.user_id === user.id
        updateSeatStatus(msg.seat_id, 'locked', {
          lock_token: msg.lock_token,
          user_id: msg.user_id,
          locked_by_me: isMe,
          expires_at: msg.expires_at,
          locked_at: new Date().toISOString(),
        })
        if (!isMe) {
          const seat = seats[msg.seat_id]
          if (seat) toast(`Seat ${seat.row}${seat.number} was just taken`, { icon: '⚡' })
        }
        break
      }

      case 'seat_released':
      case 'seat_expired': {
        updateSeatStatus(msg.seat_id, 'available', null)
        if (msg.type === 'seat_expired' && user && msg.previously_locked_by === user.id) {
          const seat = seats[msg.seat_id]
          toast.error(`Your lock on seat ${seat?.row ?? ''}${seat?.number ?? ''} expired!`)
        } else if (msg.type === 'seat_released' && msg.reason === 'expired') {
          const seat = seats[msg.seat_id]
          if (seat && (!user || msg.user_id !== user.id)) {
            // Another user's lock freed up — notify
            toast(`Seat ${seat.row}${seat.number} is now available`, { icon: '✅' })
          }
        }
        break
      }

      case 'error':
        toast.error(msg.message)
        break

      default:
        break
    }
  }, [user, seats, batchUpdateSeats, setMyLocks, updateSeatStatus])

  const { isConnected, reconnect } = useWebSocket(eventId, token, handleWsMessage)

  // ── Load initial data ────────────────────────────────────
  useEffect(() => {
    if (!eventId || !user) return

    let cancelled = false

    const load = async () => {
      try {
        const [event, seatList] = await Promise.all([
          getEvent(Number(eventId)),
          getEventSeats(Number(eventId)),
        ])
        if (cancelled) return
        eventRef.current = event
        setAllSeats(seatList)
        // Detect which seats are already ours
        const myInitialLocks = {}
        for (const s of seatList) {
          if (s.lock?.locked_by_me) myInitialLocks[s.id] = s.lock.lock_token
        }
        setMyLocks(Object.entries(myInitialLocks).map(([id, token]) => ({
          seat_id: Number(id), lock_token: token
        })))
      } catch (err) {
        toast.error('Failed to load seats')
      }
    }

    load()
    return () => { cancelled = true; resetSeats() }
  }, [eventId, user])

  // ── Group seats by row ───────────────────────────────────
  const seatsByRow = useMemo(() => {
    const byRow = {}
    for (const seat of Object.values(seats)) {
      if (!byRow[seat.row]) byRow[seat.row] = []
      byRow[seat.row].push(seat)
    }
    for (const row of Object.keys(byRow)) {
      byRow[row].sort((a, b) => a.number - b.number)
    }
    return byRow
  }, [seats])

  const rows = useMemo(() =>
    ROWS.filter(r => seatsByRow[r]?.length > 0),
    [seatsByRow]
  )

  // ── Legend stats ─────────────────────────────────────────
  const stats = useMemo(() => {
    const all = Object.values(seats)
    return {
      available: all.filter(s => s.status === 'available').length,
      locked: all.filter(s => s.status === 'locked' && !isSeatMine(s.id)).length,
      mine: Object.keys(myLocks).length,
      booked: all.filter(s => s.status === 'booked').length,
    }
  }, [seats, myLocks, isSeatMine])

  const handleCheckout = async () => {
    const seatIds = Object.keys(myLocks).map(Number)
    if (seatIds.length === 0) return toast.error('Select at least one seat')
    // Send user to our new local Checkout UI
    navigate(`/checkout?event=${eventId}&seats=${seatIds.join(',')}`)

    const result = await createCheckoutSession(Number(eventId), seatIds)
    toast.success('Redirecting to checkout…')
    setTimeout(() => navigate(result.url), 800)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Sign in to select seats</p>
          <a href="/auth/google/login" className="px-6 py-3 bg-violet-600 text-white rounded-lg font-semibold">
            Sign in with Google
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-14 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-white text-lg leading-tight">
            {eventRef.current?.name || 'Loading…'}
          </h1>
          <p className="text-xs text-gray-500">{eventRef.current?.venue_name || ''}</p>
        </div>
        <ConnectionStatus isConnected={isConnected} onReconnect={reconnect} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Seat Map */}
        <div className="flex-1 overflow-auto p-4">
          {/* Stage */}
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-gradient-to-b from-gray-700 to-gray-800 border border-gray-600 rounded-xl py-3 text-center">
              <span className="text-gray-300 text-sm font-semibold tracking-widest uppercase">
                Stage / Screen
              </span>
            </div>
          </div>

          {/* Grid */}
          <div className="max-w-3xl mx-auto space-y-2">
            {rows.map((row) => (
              <div key={row} className="flex items-center gap-2">
                {/* Row label */}
                <div className="w-6 text-center text-xs text-gray-600 font-mono font-bold shrink-0">
                  {row}
                </div>
                {/* Seats */}
                <div className="flex flex-wrap gap-1.5">
                  {seatsByRow[row]?.map((seat) => (
                    <div key={seat.id} className="mb-4"> {/* space for countdown timer */}
                      <Seat
                        seat={seat}
                        onSelect={handleSeatClick}
                        isLockedByMe={isSeatMine(seat.id)}
                        isPending={isPending(seat.id)}
                      />
                    </div>
                  ))}
                </div>
                <div className="w-6 text-center text-xs text-gray-600 font-mono font-bold shrink-0">
                  {row}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="max-w-3xl mx-auto mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-emerald-900/60 border-2 border-emerald-500 inline-block" />
              Available ({stats.available})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-violet-900/60 border-2 border-violet-400 inline-block" />
              Mine ({stats.mine})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-amber-900/60 border-2 border-amber-500 inline-block" />
              Held ({stats.locked})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-gray-800/80 border-2 border-gray-600 inline-block" />
              Booked ({stats.booked})
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 border-l border-gray-800 bg-gray-950 p-4 overflow-y-auto">
          <SelectedSeatsSidebar eventId={eventId} onCheckout={handleCheckout} />
        </div>
      </div>
    </div>
  )
}
