import { useMemo } from 'react'
import { CountdownTimer } from './CountdownTimer'
import useSeatStore from '../store/seatStore'

export function SelectedSeatsSidebar({ eventId, onCheckout }) {
  const { seats, myLocks } = useSeatStore()

  const selectedSeats = useMemo(() =>
    Object.values(seats).filter((s) => myLocks[s.id]),
    [seats, myLocks]
  )

  const total = useMemo(() =>
    selectedSeats.reduce((sum, s) => sum + Number(s.price), 0),
    [selectedSeats]
  )

  if (selectedSeats.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
        <div className="text-3xl mb-2">🎫</div>
        <p className="text-gray-500 text-sm">No seats selected</p>
        <p className="text-gray-600 text-xs mt-1">Click a green seat to select</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-gray-100 text-sm">Selected Seats</h3>
        <span className="text-xs bg-violet-900/60 text-violet-300 px-2 py-0.5 rounded-full">
          {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
        {selectedSeats.map((seat) => {
          const lock = seat.lock
          return (
            <div key={seat.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200">
                  Row {seat.row} · Seat {seat.number}
                </p>
                <p className="text-xs text-gray-500">{seat.section || 'General Admission'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-mono text-sm text-emerald-400">
                  ${Number(seat.price).toFixed(2)}
                </span>
                {lock?.expires_at && (
                  <CountdownTimer expiresAt={lock.expires_at} compact />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-gray-400">Total</span>
          <span className="font-bold text-lg text-white font-mono">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={onCheckout}
          className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-95
                     text-white font-semibold rounded-lg transition-all text-sm"
        >
          Proceed to Checkout →
        </button>
        <p className="text-xs text-center text-gray-600 mt-2">
          Locks expire if not purchased
        </p>
      </div>
    </div>
  )
}
