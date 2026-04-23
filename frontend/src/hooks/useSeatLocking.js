import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { lockSeat, releaseSeat } from '../services/api'
import useSeatStore from '../store/seatStore'

/**
 * Hook encapsulating all seat lock/release logic.
 * Uses optimistic UI updates: apply state change immediately,
 * roll back if the server rejects the request.
 *
 * @param {number} eventId
 */
export function useSeatLocking(eventId) {
  const { updateSeatStatus, addMyLock, removeMyLock, isSeatMine, getLockToken } = useSeatStore()
  const pendingRef = useRef(new Set()) // Tracks seat IDs with in-flight requests

  const handleLockSeat = useCallback(async (seat) => {
    const seatId = seat.id

    if (pendingRef.current.has(seatId)) return // Debounce double-clicks
    pendingRef.current.add(seatId)

    // ── Optimistic update ────────────────────────────────
    const prevStatus = seat.status
    const prevLock = seat.lock
    updateSeatStatus(seatId, 'locked', {
      lock_token: 'pending',
      user_id: null,
      locked_by_me: true,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    try {
      const lockResponse = await lockSeat(eventId, seatId)

      // Confirm with real data from server
      updateSeatStatus(seatId, 'locked', {
        lock_token: lockResponse.lock_token,
        user_id: lockResponse.user_id,
        locked_by_me: true,
        locked_at: lockResponse.locked_at,
        expires_at: lockResponse.expires_at,
      })
      addMyLock(seatId, lockResponse.lock_token)
      toast.success(`Seat ${seat.row}${seat.number} reserved for 10 minutes`)
    } catch (err) {
      // ── Rollback on failure ───────────────────────────
      updateSeatStatus(seatId, prevStatus, prevLock)
      const msg = err.response?.data?.detail || 'Failed to lock seat'
      toast.error(msg)
    } finally {
      pendingRef.current.delete(seatId)
    }
  }, [eventId, updateSeatStatus, addMyLock])

  const handleReleaseSeat = useCallback(async (seat) => {
    const seatId = seat.id
    const lockToken = getLockToken(seatId)

    if (!lockToken || pendingRef.current.has(seatId)) return
    pendingRef.current.add(seatId)

    // ── Optimistic update ────────────────────────────────
    const prevStatus = seat.status
    const prevLock = seat.lock
    updateSeatStatus(seatId, 'available', null)
    removeMyLock(seatId)

    try {
      await releaseSeat(eventId, lockToken)
      toast(`Seat ${seat.row}${seat.number} released`, { icon: '↩️' })
    } catch (err) {
      // ── Rollback ──────────────────────────────────────
      updateSeatStatus(seatId, prevStatus, prevLock)
      addMyLock(seatId, lockToken)
      toast.error('Failed to release seat')
    } finally {
      pendingRef.current.delete(seatId)
    }
  }, [eventId, getLockToken, updateSeatStatus, removeMyLock, addMyLock])

  const handleSeatClick = useCallback(async (seat) => {
    if (seat.status === 'booked') return

    if (isSeatMine(seat.id)) {
      await handleReleaseSeat(seat)
    } else if (seat.status === 'available') {
      await handleLockSeat(seat)
    }
    // If locked by another user — do nothing
  }, [isSeatMine, handleReleaseSeat, handleLockSeat])

  return { handleSeatClick, isPending: (seatId) => pendingRef.current.has(seatId) }
}
