import type { LatestReadingResponse } from './readings.ts'

export const measurementNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
export const measurementTime = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})
export const measurementDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
})
export const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export function utcOffsetAt(instant: string, timeZone = localTimeZone): string {
  const part = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(instant)).find((value) => value.type === 'timeZoneName')!.value
  return part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
}

export function ageAtServerCheck(snapshot: LatestReadingResponse): string | null {
  if (!snapshot.reading) return null
  const seconds = Math.floor((Date.parse(snapshot.asOf) - Date.parse(snapshot.reading.measuredAt)) / 1000)
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainder}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
