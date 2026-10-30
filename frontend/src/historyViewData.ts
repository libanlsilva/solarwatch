import { prepareHistory } from './history.ts'
import type { HistoryResponse } from './history.ts'

// Labels keep original server timestamps, including sub-millisecond precision.
export function historyViewData(snapshot: HistoryResponse) {
  const plot = prepareHistory(snapshot)
  const points = plot.points.filter(point => point.reading !== null)
  const timestamps = new Map(points.map(point => [point.x, point.reading!.measuredAt]))
  const intervals = plot.gaps.map(gap => ({
    ...gap,
    start: timestamps.get(gap.from) ?? snapshot.from,
    end: timestamps.get(gap.to) ?? snapshot.to,
    label: gap.from < points[0].x ? 'Before first reading' : gap.to > points.at(-1)!.x ? 'After last reading' : 'Between recorded readings',
  }))
  return { plot, intervals, latest: snapshot.readings.at(-1) ?? null }
}
