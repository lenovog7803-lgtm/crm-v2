import { useEffect, useRef } from 'react'

const WS_URL = (import.meta.env.VITE_API_URL || 'https://logistics-crm-backend.onrender.com/api')
  .replace(/^http/, 'ws')
  .replace(/\/api$/, '') + '/ws'

export function useRealtime(onEvent) {
  const wsRef = useRef(null)
  const retryRef = useRef(1000)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    let closed = false
    let pingTimer = null

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => { retryRef.current = 1000 }
      ws.onmessage = (e) => {
        try { onEventRef.current(JSON.parse(e.data)) } catch {}
      }
      ws.onclose = () => {
        if (closed) return
        setTimeout(connect, retryRef.current)
        retryRef.current = Math.min(retryRef.current * 1.5, 15000)
      }
      ws.onerror = () => ws.close()

      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    connect()
    return () => {
      closed = true
      clearInterval(pingTimer)
      wsRef.current?.close()
    }
  }, [])
}
