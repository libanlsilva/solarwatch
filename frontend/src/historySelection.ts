import { utcMicroseconds } from './history.ts'
import type { HistoryResponse } from './history.ts'
import type { Reading } from './readings.ts'

const minuteLength = 60_000_000n
export type HistorySelection = { kind: 'observation'; measuredAt: string } | { kind: 'minute'; minute: bigint }

export function utcMinute(instant: bigint) {
  const quotient = instant / minuteLength
  return instant < 0n && instant % minuteLength !== 0n ? quotient - 1n : quotient
}

// Construct inspection context only. Persisted measurement strings are never rewritten.
export function inspectionTimestamp(instant: bigint) {
  const milliseconds = instant / 1000n - (instant < 0n && instant % 1000n !== 0n ? 1n : 0n)
  const seconds = instant / 1_000_000n - (instant < 0n && instant % 1_000_000n !== 0n ? 1n : 0n)
  return `${new Date(Number(milliseconds)).toISOString().slice(0, 19)}.${String(instant - seconds * 1_000_000n).padStart(6, '0')}Z`
}

export function minuteBounds(snapshot: HistoryResponse) {
  return { first: utcMinute(utcMicroseconds(snapshot.from)), last: utcMinute(utcMicroseconds(snapshot.to)) }
}

export function defaultSelection(snapshot: HistoryResponse | null): HistorySelection | null {
  const reading = snapshot?.readings.at(-1)
  return reading ? { kind: 'observation', measuredAt: reading.measuredAt } : null
}

export function reconcileSelection(selection: HistorySelection | null, snapshot: HistoryResponse | null) {
  if (!snapshot?.readings.length) return { selection: null, reset: false }
  if (!selection) return { selection: defaultSelection(snapshot), reset: false }
  const { first, last } = minuteBounds(snapshot)
  const present = selection.kind === 'minute' ? selection.minute >= first && selection.minute <= last :
    utcMicroseconds(selection.measuredAt) >= utcMicroseconds(snapshot.from) && utcMicroseconds(selection.measuredAt) <= utcMicroseconds(snapshot.to)
  return present ? { selection, reset: false } : { selection: defaultSelection(snapshot), reset: true }
}

export function resolveSelection(snapshot: HistoryResponse, selection: HistorySelection) {
  const from = utcMicroseconds(snapshot.from)
  const to = utcMicroseconds(snapshot.to)
  const minute = selection.kind === 'minute' ? selection.minute : utcMinute(utcMicroseconds(selection.measuredAt))
  const start = minute * minuteLength
  const rows = snapshot.readings.filter(reading => {
    const instant = utcMicroseconds(reading.measuredAt)
    return instant >= from && instant <= to && utcMinute(instant) === minute
  })
  const reading = selection.kind === 'minute' ? rows.at(-1) ?? null :
    rows.find(row => utcMicroseconds(row.measuredAt) === utcMicroseconds(selection.measuredAt)) ?? null
  const anchor = reading ? utcMicroseconds(reading.measuredAt) : selection.kind === 'observation' ? utcMicroseconds(selection.measuredAt) : start < from ? from : start
  return { reading, minute, count: rows.length, anchor, x: Number(anchor - from) / 1000,
    partial: from > start || to < start + minuteLength - 1n }
}

export type ResolvedSelection = ReturnType<typeof resolveSelection>
export type HistoryInspection = {
  selection: HistorySelection; resolved: ResolvedSelection
  select: (selection: HistorySelection, notice?: string) => void
}

export function stepMinute(snapshot: HistoryResponse, selection: HistorySelection, delta: number): HistorySelection {
  const current = selection.kind === 'minute' ? selection.minute : utcMinute(utcMicroseconds(selection.measuredAt))
  const { first, last } = minuteBounds(snapshot)
  const next = current + BigInt(delta)
  return { kind: 'minute', minute: next < first ? first : next > last ? last : next }
}

export function stepObservation(snapshot: HistoryResponse, selection: HistorySelection, delta: -1 | 1): HistorySelection {
  const anchor = resolveSelection(snapshot, selection).anchor
  const reading = delta === 1 ? snapshot.readings.find(row => utcMicroseconds(row.measuredAt) > anchor) :
    snapshot.readings.findLast(row => utcMicroseconds(row.measuredAt) < anchor)
  return reading ? { kind: 'observation', measuredAt: reading.measuredAt } : selection
}

export function minuteAtCoordinate(snapshot: HistoryResponse, relativeMilliseconds: number): HistorySelection {
  const from = utcMicroseconds(snapshot.from)
  const to = utcMicroseconds(snapshot.to)
  const instant = from + BigInt(Math.round(relativeMilliseconds * 1000))
  return { kind: 'minute', minute: utcMinute(instant < from ? from : instant > to ? to : instant) }
}

export type PlotMark = { reading: Reading; x: number; y: number }
export function hitObservation(marks: PlotMark[], x: number, y: number, radius: number): { reading: Reading | null; ambiguous: boolean; minute?: bigint } {
  const hits = marks.filter(mark => Math.hypot(mark.x - x, mark.y - y) <= radius)
  const identities = new Set(hits.map(mark => utcMicroseconds(mark.reading.measuredAt)))
  const minuteFallback = (candidates: PlotMark[]) => {
    const minutes = new Set(candidates.map(mark => utcMinute(utcMicroseconds(mark.reading.measuredAt))))
    return { reading: null, ambiguous: true, minute: minutes.size === 1 ? minutes.values().next().value : undefined }
  }
  if (identities.size !== 1) return identities.size ? minuteFallback(hits) : { reading: null, ambiguous: false }
  const identity = identities.values().next().value!
  // A second record within one CSS pixel is visually indistinguishable even at
  // the edge of the hit target. Never attribute that collision to an exact choice.
  const overlapping = marks.filter(mark => utcMicroseconds(mark.reading.measuredAt) !== identity &&
    hits.some(hit => Math.hypot(mark.x - hit.x, mark.y - hit.y) <= 1))
  return overlapping.length ? minuteFallback([...hits, ...overlapping]) : { reading: hits[0].reading, ambiguous: false }
}
