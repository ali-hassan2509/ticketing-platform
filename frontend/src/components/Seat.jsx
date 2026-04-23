import { useState } from 'react'
import { CountdownTimer } from './CountdownTimer'

/**
 * Single seat button rendered in the venue grid.
 *
 * Status → CSS class mapping:
 *   available       → green border, hover scale
 *   locked (mine)   → violet, clickable (release)
 *   locked (other)  → amber hatched, not clickable
 *   booked          → gray hatched, not clickable
 *   loading         → pulsing gray
 */
export function Seat({ seat, onSelect, isLockedByMe, isPending }) {
  const [hovered, setHovered] = useState(false)

  const getSeatClass = () => {
    if (isPending) return 'seat-btn seat-loading'
    if (seat.status === 'booked') return 'seat-btn seat-booked'
    if (seat.status === 'locked') {
      return isLockedByMe ? 'seat-btn seat-locked-mine' : 'seat-btn seat-locked'
    }
    return 'seat-btn seat-available'
  }

  const isClickable = !isPending && seat.status !== 'booked' &&
    (seat.status === 'available' || isLockedByMe)

  const handleClick = () => {
    if (isClickable) onSelect(seat)
  }

  const lockExpiry = seat.lock?.expires_at

  return (
    <div className="relative group">
      <button
        className={getSeatClass()}
        onClick={handleClick}
        disabled={!isClickable && !isPending}
        aria-label={`Seat ${seat.row}${seat.number}, ${seat.status}${isLockedByMe ? ', yours' : ''}`}
        aria-pressed={isLockedByMe}
        role="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {isPending ? (
          <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="leading-none">
            {seat.row}{seat.number}
          </span>
        )}

        {/* Compact countdown for my locked seats */}
        {isLockedByMe && lockExpiry && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <CountdownTimer expiresAt={lockExpiry} compact />
          </div>
        )}
      </button>

      {/* Hover tooltip */}
      {hovered && !isPending && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none animate-fade-in">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-xs whitespace-nowrap shadow-xl">
            <div className="font-semibold text-gray-100">
              Row {seat.row} · Seat {seat.number}
            </div>
            <div className="text-gray-400">{seat.section || 'General'}</div>
            <div className="text-emerald-400 font-mono">${Number(seat.price).toFixed(2)}</div>
            {seat.status === 'locked' && !isLockedByMe && lockExpiry && (
              <div className="mt-1 border-t border-gray-700 pt-1">
                <CountdownTimer expiresAt={lockExpiry} compact={false} />
              </div>
            )}
            {isLockedByMe && (
              <div className="mt-1 text-violet-400">Click to release</div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  )
}
