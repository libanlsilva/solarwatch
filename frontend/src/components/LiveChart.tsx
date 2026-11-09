import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Reading } from '../readings.ts'
import type { LiveStatus } from '../liveStore.ts'
import { liveStatusLabel } from '../liveStore.ts'
import { measurementNumber, measurementTime } from '../measurementDisplay.ts'
import { prefersReducedMotion } from './AnimatedNumber.tsx'
import './live.css'

const WIDTH = 640
const HEIGHT = 240
const PAD = { top: 14, right: 12, bottom: 26, left: 44 }
const WINDOW_MS = 5 * 60_000

// A clock that advances smoothly so the plotted lines glide left between readings.
function useSmoothNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    let frame = 0
    let last = 0
    const tick = (time: number) => {
      if (time - last > 33) { last = time; setNow(Date.now()) }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])
  return now
}

const timeOf = (reading: Reading) => Date.parse(reading.measuredAt)

export function LiveChart({ points, status }: { points: readonly Reading[]; status: LiveStatus }) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const animate = status === 'live' && !prefersReducedMotion()
  const smoothNow = useSmoothNow(animate)
  const last = points.at(-1)
  const right = animate || !last ? smoothNow : timeOf(last)
  const left = right - WINDOW_MS
  const visible = useMemo(() => points.filter((reading) => timeOf(reading) >= left - 5_000), [points, left])
  const [pinned, setPinned] = useState<string | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  const peak = Math.max(1000, ...visible.map((reading) => Math.max(reading.solarPowerW, reading.consumptionPowerW)))
  const ceiling = Math.ceil(peak / 500) * 500
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (time: number) => PAD.left + ((time - left) / WINDOW_MS) * innerW
  const y = (value: number) => PAD.top + innerH - (value / ceiling) * innerH
  const line = (pick: (reading: Reading) => number) => visible.map((reading, index) => `${index ? 'L' : 'M'}${x(timeOf(reading)).toFixed(1)},${y(pick(reading)).toFixed(1)}`).join('')
  const area = (pick: (reading: Reading) => number) => visible.length > 1
    ? `${line(pick)}L${x(timeOf(visible.at(-1)!)).toFixed(1)},${y(0)}L${x(timeOf(visible[0]!)).toFixed(1)},${y(0)}Z` : ''

  // Hover resolves to the nearest plotted reading; the keyboard pins one by instant so it stays put.
  const hoverReading = useMemo(() => {
    if (hoverX === null || !visible.length) return null
    const time = left + ((hoverX - PAD.left) / innerW) * WINDOW_MS
    return visible.reduce((best, reading) => Math.abs(timeOf(reading) - time) < Math.abs(timeOf(best) - time) ? reading : best)
  }, [hoverX, visible, left, innerW])
  const selected = hoverReading ?? visible.find((reading) => reading.measuredAt === pinned) ?? null

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = svg.current!.getBoundingClientRect()
    setHoverX(((event.clientX - box.left) / box.width) * WIDTH)
    setPinned(null)
  }
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!visible.length) return
    if (event.key === 'Escape') { setPinned(null); return }
    const index = Math.max(0, visible.findIndex((reading) => reading.measuredAt === (pinned ?? last?.measuredAt)))
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: visible.length - 1 }[event.key]
    if (target === undefined) return
    event.preventDefault()
    setHoverX(null)
    setPinned(visible[Math.min(visible.length - 1, Math.max(0, target))]!.measuredAt)
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * ceiling)
  const minuteMarks = [0, 1, 2, 3, 4, 5].map((minutes) => right - minutes * 60_000)
  const tooltipLeft = selected ? Math.min(Math.max(x(timeOf(selected)), 110), WIDTH - 110) : 0

  return <section className="card live-chart" aria-labelledby={`${id}-title`} data-testid="live-chart" data-live-status={status}>
    <div className="card-top">
      <h2 id={`${id}-title`}>Live power <span className="history-unit">W</span></h2>
      <span className={`live-pill live-${status}`}><span className="live-dot" aria-hidden="true" />{liveStatusLabel(status)}</span>
    </div>
    <div className="history-legend" aria-label="Power series">
      <span><i className="solar-key" />Solar generation</span><span><i className="consumption-key" />Home consumption</span>
      <span className="live-window">Last 5 minutes</span>
    </div>
    <div className="live-plot">
      {visible.length === 0 ? <div className="history-empty"><h3>Waiting for live readings</h3><p>Points appear here as the installation reports them.</p></div> :
        <svg ref={svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" tabIndex={0} aria-label={`Live solar generation and home consumption for the last five minutes. ${visible.length} readings. Hover, or use arrow keys, to inspect a reading.`}
          onPointerMove={onPointerMove} onPointerLeave={() => setHoverX(null)} onKeyDown={onKeyDown} onBlur={() => setPinned(null)}>
          <defs>
            <linearGradient id={`${id}-solar`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--yellow)" stopOpacity=".34" /><stop offset="1" stopColor="var(--yellow)" stopOpacity="0" /></linearGradient>
            <linearGradient id={`${id}-home`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--teal)" stopOpacity=".24" /><stop offset="1" stopColor="var(--teal)" stopOpacity="0" /></linearGradient>
            <clipPath id={`${id}-clip`}><rect x={PAD.left} y={PAD.top} width={innerW} height={innerH + 2} /></clipPath>
          </defs>
          {ticks.map((value) => <g key={value}><line className="live-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} /><text className="live-axis" x={PAD.left - 8} y={y(value) + 4} textAnchor="end">{measurementNumber.format(value)}</text></g>)}
          {minuteMarks.map((time, index) => <text key={index} className="live-axis" x={x(time)} y={HEIGHT - 6} textAnchor={index === 0 ? 'end' : 'middle'}>{index === 0 ? measurementTime.format(new Date(time)) : `-${index}m`}</text>)}
          <g clipPath={`url(#${id}-clip)`}>
            <path d={area((reading) => reading.solarPowerW)} fill={`url(#${id}-solar)`} />
            <path d={area((reading) => reading.consumptionPowerW)} fill={`url(#${id}-home)`} />
            <path className="live-line solar-line" d={line((reading) => reading.solarPowerW)} />
            <path className="live-line home-line" d={line((reading) => reading.consumptionPowerW)} />
          </g>
          {last && <g className={animate ? 'live-head' : undefined}>
            <circle cx={x(timeOf(last))} cy={y(last.solarPowerW)} r="4" className="head-solar" />
            <circle cx={x(timeOf(last))} cy={y(last.consumptionPowerW)} r="4" className="head-home" />
          </g>}
          {selected && <g>
            <line className="live-cross" x1={x(timeOf(selected))} x2={x(timeOf(selected))} y1={PAD.top} y2={PAD.top + innerH} />
            <circle cx={x(timeOf(selected))} cy={y(selected.solarPowerW)} r="5" className="sel-solar" />
            <circle cx={x(timeOf(selected))} cy={y(selected.consumptionPowerW)} r="5" className="sel-home" />
          </g>}
        </svg>}
      {selected && <div className="live-tooltip" role="status" style={{ left: `${(tooltipLeft / WIDTH) * 100}%` }} data-testid="live-tooltip">
        <strong>{measurementTime.format(new Date(selected.measuredAt))}</strong>
        <span><i className="solar-key" />Solar {measurementNumber.format(selected.solarPowerW)} W</span>
        <span><i className="consumption-key" />Home {measurementNumber.format(selected.consumptionPowerW)} W</span>
        <span><i className="battery-key" />Battery {measurementNumber.format(selected.batteryStateOfChargePercent)}%</span>
      </div>}
    </div>
    <p className="sr-only">Focus the chart and press Left or Right to inspect readings, Home or End for the first and last, Escape to clear.</p>
  </section>
}
