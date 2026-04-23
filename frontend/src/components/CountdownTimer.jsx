import { useState, useEffect, useMemo } from 'react'
import { differenceInSeconds, parseISO } from 'date-fns'

/**
 * Countdown timer displayed on locked seats.
 * Color shifts: green → yellow (2 min) → orange (1 min) → red (30s)
 */
export function CountdownTimer({ expiresAt, compact = false }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const exp = typeof expiresAt === 'string' ? parseISO(expiresAt) : new Date(expiresAt)
    return Math.max(0, differenceInSeconds(exp, new Date()))
  })

  useEffect(() => {
    if (secondsLeft <= 0) return

    const timer = setInterval(() => {
      const exp = typeof expiresAt === 'string' ? parseISO(expiresAt) : new Date(expiresAt)
      const remaining = Math.max(0, differenceInSeconds(exp, new Date()))
      setSecondsLeft(remaining)
      if (remaining <= 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt])

  const { minutes, seconds, colorClass, progressPct } = useMemo(() => {
    const totalSeconds = 600 // 10 minute default lock
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    const pct = Math.round((secondsLeft / totalSeconds) * 100)

    let colorClass = 'text-emerald-400'
    if (secondsLeft <= 30) colorClass = 'text-red-400 animate-pulse'
    else if (secondsLeft <= 60) colorClass = 'text-orange-400'
    else if (secondsLeft <= 120) colorClass = 'text-yellow-400'

    return { minutes: m, seconds: s, colorClass, progressPct: pct }
  }, [secondsLeft])

  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  if (compact) {
    return <span className={`font-mono text-[10px] leading-none ${colorClass}`}>{timeStr}</span>
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-mono text-sm font-bold ${colorClass}`}>{timeStr}</span>
      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            secondsLeft <= 30
              ? 'bg-red-500'
              : secondsLeft <= 60
              ? 'bg-orange-500'
              : secondsLeft <= 120
              ? 'bg-yellow-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
