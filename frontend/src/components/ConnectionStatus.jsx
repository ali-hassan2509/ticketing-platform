export function ConnectionStatus({ isConnected, onReconnect }) {
  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
        Live
      </div>
    )
  }
  return (
    <button
      onClick={onReconnect}
      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400" />
      Reconnecting… tap to retry
    </button>
  )
}
