import { useRef } from 'react'
import { usePlotArea, useXAxisScale, useYAxisScale } from 'recharts'
import type { HistoryPlot, HistoryResponse } from '../history.ts'
import { utcMicroseconds } from '../history.ts'
import { hitObservation, minuteAtCoordinate } from '../historySelection.ts'
import type { HistoryInspection, PlotMark } from '../historySelection.ts'

// Own plot-space hit testing: Recharts' nearest active tooltip is not a user's
// exact selection. Both charts render only the canonical History inspection.
export function HistorySelectionLayer({ kind, snapshot, plot, inspection }: {
  kind: 'power' | 'battery'; snapshot: HistoryResponse; plot: HistoryPlot; inspection: HistoryInspection
}) {
  const area = usePlotArea()
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  const pointerType = useRef('mouse')
  if (!area || !xScale || !yScale) return null
  const resolved = inspection.resolved
  const x = xScale(resolved.x)
  if (x === undefined || !Number.isFinite(x)) return null
  const values = resolved.reading ? kind === 'power' ? [
    { series: 'solar', value: resolved.reading.solarPowerW, color: 'var(--yellow)' },
    { series: 'consumption', value: resolved.reading.consumptionPowerW, color: 'var(--teal)' },
  ] : [{ series: 'battery', value: resolved.reading.batteryStateOfChargePercent, color: 'var(--lime)' }] : []
  return <g className="history-selection-layer">
    <line className={`selection-cursor ${resolved.reading ? 'available' : 'unavailable'}`} x1={x} x2={x} y1={area.y} y2={area.y + area.height}
      stroke={resolved.reading ? '#c7d7c9' : '#a9bbb0'} strokeDasharray="4 4" strokeWidth={1.2} pointerEvents="none" />
    {values.map(item => {
      const y = yScale(item.value)
      return y === undefined || !Number.isFinite(y) ? null : <circle className="selection-marker" key={item.series} data-series={item.series} data-value={item.value}
        data-measured-at={resolved.reading!.measuredAt} cx={x} cy={y} r={4} fill={item.color} stroke="#06110f" strokeWidth={2} pointerEvents="none" />
    })}
    <rect className="history-inspection-target" x={area.x} y={area.y} width={area.width} height={area.height} fill="transparent"
      data-plot-x={area.x} data-plot-y={area.y} data-plot-width={area.width} data-plot-height={area.height}
      onPointerDown={event => { pointerType.current = event.pointerType }}
      onClick={event => {
        event.stopPropagation()
        const svg = event.currentTarget.ownerSVGElement!
        const transform = svg.getScreenCTM()
        if (!transform) return
        const point = svg.createSVGPoint()
        point.x = event.clientX; point.y = event.clientY
        const position = point.matrixTransform(transform.inverse())
        const width = area.width
        if (width <= 0) return
        const marks: PlotMark[] = []
        const from = utcMicroseconds(snapshot.from)
        const duration = Number(utcMicroseconds(snapshot.to) - from) / 1000
        // Same relative coordinates and scales as the existing plot, with no
        // inferred points in gaps. Millisecond coordinates never identify rows.
        for (const row of snapshot.readings) {
          const relative = Number(utcMicroseconds(row.measuredAt) - from) / 1000
          const rowX = xScale(relative)
          for (const value of kind === 'power' ? [row.solarPowerW, row.consumptionPowerW] : [row.batteryStateOfChargePercent]) {
            const rowY = yScale(value)
            if (rowX !== undefined && rowY !== undefined && Number.isFinite(rowX) && Number.isFinite(rowY)) marks.push({ reading: row, x: rowX, y: rowY })
          }
        }
        const hit = hitObservation(marks, position.x, position.y, pointerType.current === 'touch' ? 22 : 6)
        const identifiable = hit.reading && (snapshot.readings.length <= 48 || hit.reading.measuredAt === snapshot.readings.at(-1)!.measuredAt ||
          plot.points.some(point => point.reading?.measuredAt === hit.reading!.measuredAt && point.isolated))
        // A collision wholly inside one minute identifies that bucket, not one
        // of its observations. This also avoids pixel rounding to the preceding
        // minute for overlapping sub-millisecond points at a minute boundary.
        const next = identifiable ? { kind: 'observation' as const, measuredAt: hit.reading!.measuredAt } :
          'minute' in hit && hit.minute !== undefined ? { kind: 'minute' as const, minute: hit.minute } :
            minuteAtCoordinate(snapshot, (position.x - area.x) / width * duration)
        inspection.select(next, hit.ambiguous ? 'Points overlap here. Inspecting this minute; use chart arrow keys for individual readings.' : '')
        svg.closest<HTMLElement>('.history-plot')?.focus({ preventScroll: true })
      }} />
  </g>
}
