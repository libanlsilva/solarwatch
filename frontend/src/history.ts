import type { Reading } from './readings.ts'

export type HistoryResponse = { asOf: string; from: string; to: string; readings: Reading[] }
const day = 86_400_000_000n
const maxGap = 300_000_000n

// Keep the API's original strings. Date alone truncates distinct sub-millisecond instants.
export function utcMicroseconds(value: unknown): bigint {
  if (typeof value !== 'string') throw new Error('Invalid UTC timestamp')
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value)
  if (!match) throw new Error('Invalid UTC timestamp')
  const milliseconds = Date.parse(`${match[1]}Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 19) !== match[1]) {
    throw new Error('Invalid UTC timestamp')
  }
  return BigInt(milliseconds) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'))
}

export function parseHistory(value: unknown): HistoryResponse {
  if (!value || typeof value !== 'object' || !('asOf' in value) || !('from' in value) ||
    !('to' in value) || !('readings' in value) || !Array.isArray(value.readings)) throw new Error('Invalid history response')
  const asOf = utcMicroseconds(value.asOf)
  const from = utcMicroseconds(value.from)
  const to = utcMicroseconds(value.to)
  if (asOf !== to || to - from !== day) throw new Error('Invalid history window')
  let previous: bigint | null = null
  for (const item of value.readings) {
    if (!item || typeof item !== 'object' || item.installationId !== 'residential-demo' ||
      ![item.solarPowerW, item.consumptionPowerW, item.batteryStateOfChargePercent].every(
        metric => typeof metric === 'number' && Number.isFinite(metric) && metric >= 0,
      ) || item.batteryStateOfChargePercent > 100) throw new Error('Invalid history reading')
    const instant = utcMicroseconds(item.measuredAt)
    if (instant < from || instant > to || (previous !== null && instant <= previous)) throw new Error('Invalid history order or bounds')
    previous = instant
  }
  return value as HistoryResponse
}

export type HistoryPoint = {
  x: number
  solar: number | null
  consumption: number | null
  battery: number | null
  reading: Reading | null
  isolated: boolean
}
export type HistoryGap = { from: number; to: number }

export function prepareHistory(snapshot: HistoryResponse) {
  const start = utcMicroseconds(snapshot.from)
  const end = utcMicroseconds(snapshot.to)
  const times = snapshot.readings.map(reading => utcMicroseconds(reading.measuredAt))
  // Relative coordinates retain microsecond differences within a 24-hour domain, even before 1970.
  const coordinate = (instant: bigint) => Number(instant - start) / 1000
  const points: HistoryPoint[] = []
  const gaps: HistoryGap[] = []
  if (!times.length) return { points, gaps, duration: coordinate(end), powerMax: 1 }
  if (times[0] > start) gaps.push({ from: 0, to: coordinate(times[0]) })
  for (let index = 0; index < times.length; index++) {
    const instant = times[index]
    const reading = snapshot.readings[index]
    if (index > 0 && instant - times[index - 1] > maxGap) {
      const from = coordinate(times[index - 1])
      const to = coordinate(instant)
      gaps.push({ from, to })
      // A non-reading break marker prevents both strokes and area fills bridging omitted rows.
      points.push({ x: (from + to) / 2, solar: null, consumption: null, battery: null, reading: null, isolated: false })
    }
    points.push({
      x: coordinate(instant), solar: reading.solarPowerW, consumption: reading.consumptionPowerW,
      battery: reading.batteryStateOfChargePercent, reading,
      isolated: (index === 0 || instant - times[index - 1] > maxGap) &&
        (index === times.length - 1 || times[index + 1] - instant > maxGap),
    })
  }
  if (times.at(-1)! < end) gaps.push({ from: coordinate(times.at(-1)!), to: coordinate(end) })
  const powerMax = snapshot.readings.reduce((maximum, reading) => Math.max(maximum, reading.solarPowerW, reading.consumptionPowerW), 0)
  return { points, gaps, duration: coordinate(end), powerMax: powerMax || 1 }
}

export type HistoryPlot = ReturnType<typeof prepareHistory>

export function localHistoryTime(instant: string, timeZone?: string, includeDate = true) {
  const date = new Date(instant)
  const options: Intl.DateTimeFormatOptions = {
    timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    ...(includeDate ? { year: 'numeric', month: 'short', day: 'numeric' } as const : {}),
  }
  const fractional = /\.(\d+)/.exec(instant)?.[1]
  return `${new Intl.DateTimeFormat(undefined, options).format(date)}${fractional ? `.${fractional}` : ''}`
}
