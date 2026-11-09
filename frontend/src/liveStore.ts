import { utcMicroseconds } from './history.ts'
import type { LatestReadingState } from './latestReadingQuery.ts'
import type { Reading } from './readings.ts'

export type LiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting' | 'offline'

export const LIVE_PREFERENCE_KEY = 'solarwatch.live'
export const LIVE_WINDOW_POINTS = 240

// Live updates are on unless the viewer paused them. Storage may be unavailable (private windows).
export function readLivePreference(): boolean {
  try { return window.localStorage.getItem(LIVE_PREFERENCE_KEY) !== 'off' } catch { return true }
}

export function writeLivePreference(enabled: boolean) {
  try { window.localStorage.setItem(LIVE_PREFERENCE_KEY, enabled ? 'on' : 'off') } catch { /* preference is a convenience only */ }
}

function instant(reading: Reading): bigint {
  try { return utcMicroseconds(reading.measuredAt) } catch { return BigInt(Date.parse(reading.measuredAt)) * 1000n }
}

// An older response (slow HTTP refresh, replayed event) must never overwrite a newer reading.
export function mergeLatest(previous: LatestReadingState, next: LatestReadingState): LatestReadingState {
  const before = previous.snapshot?.reading
  const after = next.snapshot?.reading
  if (before && after && instant(before) > instant(after)) return { ...next, snapshot: previous.snapshot }
  return next
}

// Newest-last, unique by measurement instant, bounded.
export function mergePoints(existing: readonly Reading[], incoming: readonly Reading[], max = LIVE_WINDOW_POINTS): Reading[] {
  const byInstant = new Map<bigint, Reading>()
  for (const reading of [...existing, ...incoming]) byInstant.set(instant(reading), reading)
  return [...byInstant.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).slice(-max).map(([, reading]) => reading)
}

export type PowerFlow = {
  solarW: number
  homeW: number
  // Derived from solar - home. Battery power itself is not measured.
  battery: 'charging' | 'discharging' | 'idle'
  batteryW: number
}

export const BATTERY_DEADBAND_W = 50

export function derivePowerFlow(reading: Pick<Reading, 'solarPowerW' | 'consumptionPowerW'>): PowerFlow {
  const net = reading.solarPowerW - reading.consumptionPowerW
  return {
    solarW: reading.solarPowerW,
    homeW: reading.consumptionPowerW,
    battery: net > BATTERY_DEADBAND_W ? 'charging' : net < -BATTERY_DEADBAND_W ? 'discharging' : 'idle',
    batteryW: Math.abs(net) <= BATTERY_DEADBAND_W ? 0 : Math.abs(net),
  }
}

export function liveStatusLabel(status: LiveStatus): string {
  return { off: 'Live paused', connecting: 'Connecting…', live: 'Live', reconnecting: 'Reconnecting…', offline: 'Offline' }[status]
}
