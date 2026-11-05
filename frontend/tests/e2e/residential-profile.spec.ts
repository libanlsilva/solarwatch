import { spawnSync } from 'node:child_process'
import { test, expect } from './browser.ts'
import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

// Keep sub-millisecond identity independently of Date's millisecond coordinates.
function micros(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?(?:Z|\+00:00)$/.exec(value)
  if (!match) throw new Error('Expected an explicit UTC timestamp from the real API/CLI.')
  return BigInt(Date.parse(`${match[1]}Z`)) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0').slice(0, 6))
}

test('residential-v1 CLI persists exact UTC samples and React renders those values after Refresh', async ({ page, request }, testInfo) => {
  test.setTimeout(150_000)
  const reference = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const endAt = reference.asOf as string // Do not truncate through Date.toISOString().
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  const cli = spawnSync('dotnet', [
    '../simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll',
    '--history-24h', '--profile', 'residential-v1', '--seed', '42', '--end-at', endAt,
    '--api-url', 'http://127.0.0.1:5181',
  ], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(SOLARWATCH_(E2E|TEST)_CONNECTION|ConnectionStrings__|POSTGRES_)/i.test(key))),
  })
  expect(cli.status, 'actual residential CLI against isolated PostgreSQL/API').toBe(0)
  expect(cli.stderr).toBe('')
  expect(cli.stdout).toContain('Profile: residential-v1')
  expect(cli.stdout).toContain('accepted=1441, rejected=0, conflicts=0, errors=0, uncertain=0, unattempted=0')
  const accepted = [...cli.stdout.matchAll(/^Accepted (\S+): solar=([\d.]+) W, consumption=([\d.]+) W, battery=([\d.]+)%/gm)]
    .map(match => ({ measuredAt: match[1], solarPowerW: Number(match[2]), consumptionPowerW: Number(match[3]), batteryStateOfChargePercent: Number(match[4]) }))
  expect(accepted).toHaveLength(1441)
  const end = micros(endAt)
  expect(accepted.map(row => micros(row.measuredAt).toString())).toEqual(
    Array.from({ length: 1441 }, (_, index) => (end - 86_400_000_000n + BigInt(index) * 60_000_000n).toString()))
  expect(accepted[0].batteryStateOfChargePercent).toBe(50)
  expect(accepted.some(row => row.solarPowerW === 0)).toBe(true)
  expect(accepted.some(row => row.solarPowerW > 3900)).toBe(true)
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  const received = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  const history = await (await received).json()
  type Row = typeof accepted[number]
  const rows = history.readings as Row[]
  const inWindow = accepted.filter(row => micros(row.measuredAt) >= micros(history.from) && micros(row.measuredAt) <= micros(history.to))
  expect(rows.length).toBeGreaterThan(1400)
  const values = (row: Row) => [micros(row.measuredAt).toString(), row.solarPowerW, row.consumptionPowerW, row.batteryStateOfChargePercent]
  expect(rows.map(values)).toEqual(inWindow.map(values))
  const powerScales: number[] = []
  for (const [series, key, curve] of [['solar', 'solarPowerW', 'area'], ['consumption', 'consumptionPowerW', 'line'], ['battery', 'batteryStateOfChargePercent', 'area']] as const) {
    const path = page.locator(`.${series}-series .recharts-${curve}-curve`)
    await expect(path).toBeVisible()
    const vertices = [...(await path.getAttribute('d'))!.matchAll(/[ML]([-\d.eE]+),([-\d.eE]+)/g)]
      .map(point => ({ x: Number(point[1]), y: Number(point[2]) }))
    expect(vertices).toHaveLength(rows.length)
    const numbers = rows.map(row => row[key])
    const low = Math.min(...numbers)
    const high = Math.max(...numbers)
    expect(high).toBeGreaterThan(low)
    const lowPoint = vertices[numbers.indexOf(low)]
    const highPoint = vertices[numbers.indexOf(high)]
    const scale = (highPoint.y - lowPoint.y) / (high - low)
    expect(scale).toBeLessThan(0)
    if (series !== 'battery') powerScales.push(scale)
    const elapsed = Number(micros(rows.at(-1)!.measuredAt) - micros(rows[0].measuredAt))
    const errors = vertices.map((vertex, index) => {
      const fraction = Number(micros(rows[index].measuredAt) - micros(rows[0].measuredAt)) / elapsed
      return { x: Math.abs(vertex.x - (vertices[0].x + fraction * (vertices.at(-1)!.x - vertices[0].x))),
        y: Math.abs(vertex.y - (lowPoint.y + (numbers[index] - low) * scale)) }
    })
    // Check every vertex, with aggregate assertions to avoid thousands of trace steps.
    expect(Math.max(...errors.map(error => error.x))).toBeLessThan(.002)
    expect(Math.max(...errors.map(error => error.y))).toBeLessThan(.002)
    // Dense plots deliberately draw only the final marker, while paths retain every sample.
    const marker = page.locator(`circle.history-point[data-series="${series}"]`).last()
    await expect(marker).toHaveAttribute('data-measured-at', rows.at(-1)!.measuredAt)
    await expect(marker).toHaveAttribute('data-value', String(numbers.at(-1)!))
  }
  expect(Math.abs(powerScales[0] - powerScales[1])).toBeLessThan(.000005)
  const latest = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  expect(micros(latest.reading.measuredAt)).toBe(end)
  expect(latest.reading.solarPowerW).toBe(accepted.at(-1)!.solarPowerW)
  expect(latest.reading.batteryStateOfChargePercent).toBe(accepted.at(-1)!.batteryStateOfChargePercent)
  await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
  const displayCharge = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(latest.reading.batteryStateOfChargePercent)
  await expect(page.getByTestId('battery-charge')).toHaveText(`${displayCharge}%`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Technical model comparisons, not definitive portfolio captures.
  await page.locator('.power-history').screenshot({ path: testInfo.outputPath('residential-power.png') })
  await page.locator('.battery-history').screenshot({ path: testInfo.outputPath('residential-battery.png') })
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', latest.reading.measuredAt)
  await expect(page.getByTestId('history-selected-battery')).toHaveText(`${latest.reading.batteryStateOfChargePercent}%`)
  await testInfo.attach('residential-profile-evidence.json', { contentType: 'application/json', body: JSON.stringify({
    profile: 'residential-v1', seed: 42, reference: endAt, accepted: accepted.length,
    first: accepted[0], last: accepted.at(-1), from: history.from, to: history.to, asOf: history.asOf,
    persistedInLiveWindow: rows.length, summary: cli.stdout.split('\n').find(line => line.startsWith('Summary')),
    source: 'actual CLI -> local HTTP ingestion -> PostgreSQL -> history API -> all three existing chart series; no API mocks',
  }, null, 2) })
})
