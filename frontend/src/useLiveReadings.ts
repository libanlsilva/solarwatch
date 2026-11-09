import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useEffect, useRef, useState } from 'react'
import { parseLatestReading } from './readings.ts'
import type { LatestReadingResponse } from './readings.ts'
import type { LiveStatus } from './liveStore.ts'

const HUB_URL = '/hubs/readings'
const RECONNECT_CAP_MS = 10_000

// Backoff 0, 1 s, 2 s, 4 s … capped; it never gives up, so a restarted API resumes the stream.
export function reconnectDelay(previousRetryCount: number): number {
  return previousRetryCount === 0 ? 0 : Math.min(1000 * 2 ** (previousRetryCount - 1), RECONNECT_CAP_MS)
}

/**
 * Subscribes to the SignalR `reading` event. `onConnected` fires after every (re)connect so the
 * caller can resynchronize through HTTP: events missed while offline are never replayed.
 */
export function useLiveReadings(enabled: boolean, onReading: (response: LatestReadingResponse) => void, onConnected: () => void): LiveStatus {
  const [connected, setConnected] = useState<LiveStatus>('connecting')
  const handlers = useRef({ onReading, onConnected })
  useEffect(() => { handlers.current = { onReading, onConnected } })

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (context) => reconnectDelay(context.previousRetryCount) })
      .configureLogging(LogLevel.None)
      .build()
    connection.on('reading', (payload: unknown) => {
      try { handlers.current.onReading(parseLatestReading(payload)) } catch { /* ignore a malformed event */ }
    })
    connection.onreconnecting(() => { if (!disposed) setConnected('reconnecting') })
    connection.onreconnected(() => { if (!disposed) { setConnected('live'); handlers.current.onConnected() } })
    connection.onclose(() => { if (!disposed) setConnected('offline') })
    void (async () => {
      setConnected('connecting')
      while (!disposed) {
        try {
          await connection.start()
          if (disposed) return
          setConnected('live')
          handlers.current.onConnected()
          return
        } catch {
          if (disposed) return
          setConnected('offline')
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }
    })()
    return () => { disposed = true; void connection.stop() }
  }, [enabled])

  return enabled ? connected : 'off'
}
