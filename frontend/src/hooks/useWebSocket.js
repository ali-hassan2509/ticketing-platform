import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`

const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}

/**
 * Custom WebSocket hook with:
 * - Auto-reconnect with exponential backoff (up to 30s)
 * - Heartbeat ping/pong every 25 seconds
 * - Message queuing while disconnected
 * - Clean teardown on unmount
 *
 * @param {string} eventId - The event to subscribe to
 * @param {string|null} token - JWT auth token
 * @param {function} onMessage - Callback for incoming messages
 */
export function useWebSocket(eventId, token, onMessage) {
  const wsRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const messageQueueRef = useRef([])
  const mountedRef = useRef(true)
  const onMessageRef = useRef(onMessage)
  const guestId = localStorage.getItem('guest_session_id')
    const url = token
      ? `${WS_BASE}/ws/${eventId}?token=${token}`
      : `${WS_BASE}/ws/${eventId}?guest_id=${guestId}`

  const [readyState, setReadyState] = useState(READY_STATE.CLOSED)
  const [connectionCount, setConnectionCount] = useState(0)

  // Keep onMessage ref fresh without re-triggering the effect
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const getBackoffDelay = (attempt) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
    return Math.min(1000 * 2 ** attempt, 30_000)
  }

  const startHeartbeat = useCallback(() => {
    clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === READY_STATE.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25_000)
  }, [])

  const stopHeartbeat = useCallback(() => {
    clearInterval(heartbeatTimerRef.current)
  }, [])

  const flushQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift()
      if (wsRef.current?.readyState === READY_STATE.OPEN) {
        wsRef.current.send(JSON.stringify(msg))
      }
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (!eventId) return

    // Don't double-connect
    if (wsRef.current?.readyState === READY_STATE.OPEN) return

    const url = token
      ? `${WS_BASE}/ws/${eventId}?token=${token}`
      : `${WS_BASE}/ws/${eventId}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    setReadyState(READY_STATE.CONNECTING)

    ws.onopen = () => {
      if (!mountedRef.current) return
      reconnectAttemptRef.current = 0
      setReadyState(READY_STATE.OPEN)
      setConnectionCount((n) => n + 1)
      startHeartbeat()
      flushQueue()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        console.warn('WS: could not parse message', event.data)
      }
    }

    ws.onclose = (event) => {
      if (!mountedRef.current) return
      stopHeartbeat()
      setReadyState(READY_STATE.CLOSED)

      // Don't reconnect on intentional close (code 1000)
      if (event.code === 1000) return

      const delay = getBackoffDelay(reconnectAttemptRef.current)
      reconnectAttemptRef.current += 1
      console.info(`WS: reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`)
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = (err) => {
      console.error('WS error:', err)
    }
  }, [eventId, token, startHeartbeat, stopHeartbeat, flushQueue])

  // Connect on mount / when eventId or token changes
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)
      clearInterval(heartbeatTimerRef.current)
      wsRef.current?.close(1000, 'component unmounted')
    }
  }, [connect])

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === READY_STATE.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      // Queue for when connection re-establishes
      messageQueueRef.current.push(message)
    }
  }, [])

  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current)
    wsRef.current?.close()
    reconnectAttemptRef.current = 0
    connect()
  }, [connect])

  return {
    sendMessage,
    readyState,
    isConnected: readyState === READY_STATE.OPEN,
    connectionCount,
    reconnect,
  }
}
