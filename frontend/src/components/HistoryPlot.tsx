import { useEffect, useId, useRef, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { localHistoryTime, utcMicroseconds } from '../history.ts'
import type { HistoryPoint, HistoryPlot, HistoryResponse } from '../history.ts'
import type { Reading } from '../readings.ts'
import { measurementDate, utcOffsetAt } from '../measurementDisplay.ts'

const axisTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const axisNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumSignificantDigits: 3 })
const readingNumber = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 15 })
const colors = { solar: 'var(--yellow)', consumption: 'var(--teal)', battery: 'var(--lime)' }

function HistoryTooltip({ active, payload, kind, readingOverride, onRead }: {
  active?: boolean; payload?: ReadonlyArray<{ payload?: HistoryPoint }>; kind: 'power' | 'battery'
  readingOverride?: Reading; onRead?: (reading: Reading) => void
}) {
  const reading = readingOverride ?? payload?.find(item => item.payload?.reading)?.payload?.reading
  useEffect(() => { if (active && reading) onRead?.(reading) }, [active, reading, onRead])
  if (!active || !reading) return null
  return <div className="history-tooltip" role="tooltip">
    <time dateTime={reading.measuredAt}>{localHistoryTime(reading.measuredAt, undefined, false)}</time>
    <p>{measurementDate.format(new Date(reading.measuredAt))} · {utcOffsetAt(reading.measuredAt)}</p>
    {kind === 'power' ? <>
      <p><span className="solar-text">Solar</span> <strong>{readingNumber.format(reading.solarPowerW)} W</strong></p>
      <p><span className="consumption-text">Home</span> <strong>{readingNumber.format(reading.consumptionPowerW)} W</strong></p>
    </> : <p><span className="battery-text">Battery</span> <strong>{readingNumber.format(reading.batteryStateOfChargePercent)}%</strong></p>}
  </div>
}

function HistoryDot({ cx, cy, payload, series, showAll, lastTimestamp }: {
  cx?: number; cy?: number; payload?: HistoryPoint; series: keyof typeof colors; showAll: boolean; lastTimestamp: string
}) {
  const endpoint = payload?.reading?.measuredAt === lastTimestamp
  if (!payload?.reading || (!showAll && !payload.isolated && !endpoint)) return null
  return <circle className="history-point" cx={cx} cy={cy} r={payload.isolated || endpoint ? 3 : 1.5}
    fill={colors[series]} data-series={series} data-measured-at={payload.reading.measuredAt}
    data-value={payload[series]} />
}

export default function HistoryPlotView({ kind, snapshot, plot }: { kind: 'power' | 'battery'; snapshot: HistoryResponse; plot: HistoryPlot }) {
  const id = useId().replace(/:/g, '')
  const inspected = useRef(0)
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const battery = kind === 'battery'
  const startMilliseconds = Number(utcMicroseconds(snapshot.from) / 1000n)
  const ticks = [0, plot.duration / 4, plot.duration / 2, plot.duration * 3 / 4, plot.duration]
  const showAll = snapshot.readings.length <= 48
  const lastTimestamp = snapshot.readings.at(-1)!.measuredAt
  return <div className={`history-plot ${kind}-plot`} data-testid={`${kind}-plot`}
    onPointerDownCapture={() => { setKeyboardIndex(null); setDismissed(false) }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setKeyboardIndex(null); setDismissed(true) } }}
    onKeyDownCapture={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') { setDismissed(true); setKeyboardIndex(null); return }
      const next = Math.max(0, Math.min(snapshot.readings.length - 1, (keyboardIndex ?? inspected.current) + (event.key === 'ArrowRight' ? 1 : -1)))
      inspected.current = next
      setKeyboardIndex(next)
      setDismissed(false)
    }}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={plot.points} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}
        accessibilityLayer aria-label={`${battery ? 'Battery charge history in percent' : 'Solar generation and home consumption history in watts'}. Use arrow keys to inspect recorded readings.`}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={battery ? colors.battery : colors.solar} stopOpacity=".16" />
            <stop offset="100%" stopColor={battery ? colors.battery : colors.solar} stopOpacity="0" />
          </linearGradient>
          <pattern id={`gap-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="8" height="8" fill="#829b8b" fillOpacity=".035" />
            <line x1="0" x2="0" y1="0" y2="8" stroke="#829b8b" strokeOpacity=".18" />
          </pattern>
        </defs>
        <CartesianGrid stroke="#31513a66" vertical={false} />
        <XAxis dataKey="x" type="number" scale="linear" domain={[0, plot.duration]} ticks={ticks}
          allowDataOverflow tickFormatter={value => axisTime.format(new Date(startMilliseconds + Number(value)))}
          tick={{ fill: '#a9bbb0', fontSize: 12 }} tickLine={false} axisLine={false} height={27} minTickGap={12} />
        <YAxis domain={[0, battery ? 100 : plot.powerMax]} ticks={battery ? [0, 50, 100] : [0, plot.powerMax / 2, plot.powerMax]}
          tickFormatter={value => axisNumber.format(Number(value))} tick={{ fill: '#a9bbb0', fontSize: 12 }}
          axisLine={false} tickLine={false} width={43} padding={{ top: 4, bottom: 4 }} />
        {plot.gaps.map((gap, index) => <ReferenceArea key={index} className="history-gap" x1={gap.from} x2={gap.to}
          fill={`url(#gap-${id})`} fillOpacity={1} strokeOpacity={0} />)}
        <Tooltip trigger="click" cursor={false} isAnimationActive={false} allowEscapeViewBox={{ x: false, y: false }}
          active={dismissed ? false : keyboardIndex !== null ? true : undefined}
          position={keyboardIndex !== null ? { x: 45, y: 5 } : undefined}
          content={props => <HistoryTooltip {...props} kind={kind} readingOverride={keyboardIndex === null ? undefined : snapshot.readings[keyboardIndex]}
            onRead={reading => { if (keyboardIndex === null) inspected.current = snapshot.readings.indexOf(reading) }} />} />
        <Area className={`history-series ${battery ? 'battery-series' : 'solar-series'}`} dataKey={battery ? 'battery' : 'solar'}
          name={battery ? 'Battery charge' : 'Solar generation'} unit={battery ? '%' : ' W'} type="linear" connectNulls={false}
          stroke={battery ? colors.battery : colors.solar} strokeWidth={2.2} fill={`url(#fill-${id})`}
          isAnimationActive={false} activeDot={false}
          dot={props => <HistoryDot {...props} series={battery ? 'battery' : 'solar'} showAll={showAll} lastTimestamp={lastTimestamp} />} />
        {!battery && <Line className="history-series consumption-series" dataKey="consumption" name="Home consumption" unit=" W"
          type="linear" connectNulls={false} stroke={colors.consumption} strokeWidth={2} strokeDasharray="5 5"
          isAnimationActive={false} activeDot={false}
          dot={props => <HistoryDot {...props} series="consumption" showAll={showAll} lastTimestamp={lastTimestamp} />} />}
      </ComposedChart>
    </ResponsiveContainer>
  </div>
}
