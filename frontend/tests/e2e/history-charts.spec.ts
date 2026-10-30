import { test, expect, boundExternalFonts } from './browser.ts'
import type { APIRequestContext, Page } from '@playwright/test'
import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

async function persist(request: APIRequestContext, measuredAt: string, solarPowerW: number, consumptionPowerW: number, batteryStateOfChargePercent: number) {
  const response = await request.post('http://127.0.0.1:5181/api/readings', { data: {
    installationId: 'residential-demo', measuredAt, solarPowerW, consumptionPowerW, batteryStateOfChargePercent,
  } })
  expect(response.status()).toBe(201)
  return (await response.json()).reading
}

async function samples(request: APIRequestContext) {
  const { asOf } = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const minute = Math.floor(Date.parse(asOf) / 60_000) * 60_000
  const at = (milliseconds: number, fraction = '123456') => `${new Date(milliseconds).toISOString().slice(0, 19)}.${fraction}Z`
  const first = minute - 23 * 60 * 60_000
  return [
    await persist(request, at(first), 0, 100, 0),
    await persist(request, at(first + 60_000), 800, 600, 25),
    await persist(request, at(first + 240_000), 1600, 200, 50),
    await persist(request, at(first + 540_000), 1200, 400, 75), // Exactly 300 seconds since the previous record.
    await persist(request, at(first + 840_000, '123457'), 2000, 900, 80), // 300 seconds plus one microsecond.
    await persist(request, at(minute - 60_000), 3000, 1200, 100),
  ]
}

function points(page: Page, series: 'solar' | 'consumption' | 'battery') {
  return page.locator(`circle.history-point[data-series="${series}"]`)
}

test('real PostgreSQL history determines values, elapsed-time geometry, gaps and manual discovery of a new sample', async ({ page, request }) => {
  const rows = await samples(request)
  let latestCalls = 0
  let historyCalls = 0
  page.on('request', request => {
    if (request.url().endsWith('/api/readings/latest')) latestCalls++
    if (request.url().endsWith('/api/readings/history')) historyCalls++
  })
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.setViewportSize({ width: 1440, height: 1186 })
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
  await page.goto('/')
  const history = await (await loaded).json()
  await expect(points(page, 'solar')).toHaveCount(6)
  await expect(points(page, 'battery')).toHaveCount(6)
  expect(history.readings).toEqual(rows)
  await expect(page.getByTestId('power-range').locator('time').first()).toHaveAttribute('datetime', history.from)
  await expect(page.getByTestId('power-range').locator('time').last()).toHaveAttribute('datetime', history.to)
  await expect(page.getByTestId('power-history-asof')).toHaveAttribute('datetime', history.asOf)
  const coordinates = await points(page, 'solar').evaluateAll(elements => elements.map(element => ({
    x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')), at: element.getAttribute('data-measured-at'), value: Number(element.getAttribute('data-value')),
  })))
  expect(coordinates.map(point => point.at)).toEqual(rows.map(row => row.measuredAt))
  expect(coordinates.map(point => point.value)).toEqual([0, 800, 1600, 1200, 2000, 3000])
  expect((coordinates[2].x - coordinates[1].x) / (coordinates[1].x - coordinates[0].x)).toBeCloseTo(3, 5)
  expect((coordinates[0].y - coordinates[2].y) / (coordinates[0].y - coordinates[5].y)).toBeCloseTo(1600 / 3000, 5)
  const charge = await points(page, 'battery').evaluateAll(elements => elements.map(element => Number(element.getAttribute('cy'))))
  expect((charge[0] - charge[1]) / (charge[0] - charge[5])).toBeCloseTo(.25, 5)
  // Three disconnected segments: four nearby points, the microsecond-threshold point, the latest point.
  for (const selector of ['.solar-series .recharts-area-curve', '.consumption-series .recharts-line-curve', '.battery-series .recharts-area-curve', '.solar-series .recharts-area-area', '.battery-series .recharts-area-area']) {
    const path = await page.locator(selector).getAttribute('d')
    expect(path!.match(/M/g), selector).toHaveLength(3)
  }
  await expect(page.locator('.power-history .history-gap')).toHaveCount(4) // Two interior gaps and both uncovered edges.
  await expect(page.locator('.power-history')).toContainText('Partial history')
  await expect(page.locator('.consumption-series .recharts-line-curve')).toHaveAttribute('stroke-dasharray', '5 5')

  const previousRange = await page.getByTestId('power-range').textContent()
  const now = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const fresh = await persist(request, now.asOf, 1777, 888, 60)
  await page.clock.fastForward(10 * 60_000)
  expect(latestCalls).toBe(1)
  expect(historyCalls).toBe(1)
  await expect(points(page, 'solar')).toHaveCount(6)
  await expect(page.getByTestId('power-range')).toHaveText(previousRange!)
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(points(page, 'solar')).toHaveCount(7)
  await expect(points(page, 'solar').last()).toHaveAttribute('data-measured-at', fresh.measuredAt)
  await expect(page.getByTestId('solar-power')).toHaveText('1,777 W')
  expect(latestCalls).toBe(2)
  expect(historyCalls).toBe(2)
})

test('history errors retain its own window while Latest remains usable; History Retry cannot refresh Latest', async ({ page, request }) => {
  await samples(request)
  let latestCalls = 0
  page.on('request', request => { if (request.url().endsWith('/api/readings/latest')) latestCalls++ })
  await page.goto('/')
  await expect(points(page, 'solar')).toHaveCount(6)
  const reference = await page.getByTestId('power-history-asof').getAttribute('datetime')
  const range = await page.getByTestId('power-range').innerHTML()
  const curve = await page.locator('.solar-series .recharts-area-curve').getAttribute('d')
  await page.route('**/api/readings/history', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.locator('.power-history [role="alert"]')).toContainText('Previous history')
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await expect(page.getByTestId('power-history-asof')).toHaveAttribute('datetime', reference!)
  expect(await page.getByTestId('power-range').innerHTML()).toBe(range)
  await expect(page.locator('.solar-series .recharts-area-curve')).toHaveAttribute('d', curve!)
  await page.unroute('**/api/readings/history')
  await page.route('**/api/readings/latest', route => route.abort())
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.locator('.hero [role="alert"]')).toBeVisible()
  await expect(page.locator('.power-history')).toHaveAttribute('data-history-state', 'ready')
  await expect(points(page, 'solar')).toHaveCount(6)
  await page.route('**/api/readings/history', route => route.fulfill({ json: { asOf: 'invalid', readings: [] } }))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.power-history [role="alert"]')).toContainText('Previous history')
  const callsBeforeRetry = latestCalls
  command('clear-demo', '--confirm')
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry', exact: true }).click()
  await expect(page.locator('.power-history')).toHaveAttribute('data-history-state', 'empty')
  await expect(points(page, 'solar')).toHaveCount(0)
  await expect(page.getByTestId('power-plot')).toHaveCount(0)
  await expect(page.getByTestId('power-history-asof')).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await expect(page.locator('.hero [role="alert"]')).toBeVisible()
  expect(latestCalls).toBe(callsBeforeRetry)
})

test('initial History loading and failure never hide healthy metrics or manufacture successful metadata', async ({ page, request }) => {
  await samples(request)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/readings/history', async route => { await gate; await route.abort() })
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await expect(page.locator('.history-skeleton')).toHaveCount(2)
  await expect(page.getByTestId('power-history-asof')).toHaveCount(0)
  await expect(page.getByTestId('power-range')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh available data' })).toBeEnabled()
  release()
  await expect(page.locator('.power-history [role="alert"]')).toContainText('History is unavailable')
  await expect(page.getByTestId('power-history-asof')).toHaveCount(0)
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry' }).click()
  await expect(points(page, 'solar')).toHaveCount(6)
  await expect(page.locator('.history-skeleton')).toHaveCount(0)
})

test('shared Refresh uses each eligible resource independently and prevents duplicates while either request is delayed', async ({ page, request }) => {
  await samples(request)
  const calls = { latest: 0, history: 0 }
  page.on('request', request => {
    if (request.url().endsWith('/api/readings/latest')) calls.latest++
    if (request.url().endsWith('/api/readings/history')) calls.history++
  })
  await page.goto('/')
  await expect(points(page, 'solar')).toHaveCount(6)
  const reference = await page.getByTestId('power-history-asof').getAttribute('datetime')
  let releaseHistory!: () => void
  const historyGate = new Promise<void>(resolve => { releaseHistory = resolve })
  await page.route('**/api/readings/history', async route => { await historyGate; await route.continue() })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('button', { name: 'Refresh available data' })).toBeEnabled()
  await expect(page.locator('.power-history .history-notice')).toContainText('Refreshing history')
  await expect(page.getByTestId('power-history-asof')).toHaveAttribute('datetime', reference!)
  await page.getByRole('button', { name: 'Refresh available data' }).evaluate((element: HTMLButtonElement) => { element.click(); element.click() })
  await expect.poll(() => calls.latest).toBe(3)
  expect(calls.history).toBe(2)
  releaseHistory()
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeEnabled()
  await page.unroute('**/api/readings/history')

  let releaseLatest!: () => void
  const latestGate = new Promise<void>(resolve => { releaseLatest = resolve })
  await page.route('**/api/readings/latest', async route => { await latestGate; await route.continue() })
  await page.route('**/api/readings/history', route => route.abort())
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('button', { name: 'Refresh available data' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'History Retry' })).toBeVisible()
  const heldLatestCalls = calls.latest
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry' }).click()
  await expect(page.locator('.power-history')).toHaveAttribute('data-history-state', 'ready')
  expect(calls.latest).toBe(heldLatestCalls)
  await page.getByRole('button', { name: 'Refresh available data' }).click()
  await expect.poll(() => calls.history).toBe(5)
  expect(calls.latest).toBe(heldLatestCalls)
  releaseLatest()
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeEnabled()
})

test('charts preserve original microsecond readings in basic keyboard and touch readouts without synchronized selectors', async ({ browser, request }) => {
  const rows = await samples(request)
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, timezoneId: 'America/Havana', reducedMotion: 'reduce' })
  const page = await context.newPage()
  await boundExternalFonts(page)
  try {
    await page.goto('http://127.0.0.1:4181/')
    await expect(points(page, 'solar')).toHaveCount(6)
    await points(page, 'solar').last().tap()
    await expect(page.locator('.power-history [role="tooltip"] time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
    await expect(page.locator('.power-history [role="tooltip"]')).toContainText('3,000 W')
    await page.getByTestId('power-plot').locator('svg[tabindex="0"]').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.power-history [role="tooltip"] time')).toHaveAttribute('datetime', rows[4].measuredAt)
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.power-history [role="tooltip"] time')).toHaveAttribute('datetime', rows[3].measuredAt)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.power-history [role="tooltip"] time')).toHaveAttribute('datetime', rows[4].measuredAt)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.power-history [role="tooltip"] time')).toHaveAttribute('datetime', rows[5].measuredAt)
    await page.keyboard.press('Escape')
    await expect(page.locator('.power-history [role="tooltip"]')).toHaveCount(0)
    await expect(page.getByRole('slider')).toHaveCount(0)
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 900 ? 844 : 1186 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true)
      const clipped = await page.locator('.history-card').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className))
      expect(clipped, `history card overflow at ${width}`).toEqual([])
      await expect(page.getByTestId('power-plot')).toBeVisible()
      await expect(page.getByTestId('battery-plot')).toBeVisible()
    }
  } finally { await context.close() }
})

test('a failed chart-module download is contained while real metrics and server metadata remain usable', async ({ page, request }) => {
  await samples(request)
  await page.route('**/assets/HistoryPlot-*.js', route => route.abort())
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await expect(page.getByRole('heading', { name: 'Chart display is unavailable' })).toHaveCount(2)
  await expect(page.getByTestId('power-history-asof')).toBeVisible()
  await expect(page.getByTestId('battery-history-asof')).toBeVisible()
  const checkedAt = await page.getByTestId('checked-at').getAttribute('datetime')
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByTestId('checked-at')).not.toHaveAttribute('datetime', checkedAt!)
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await expect(page.getByRole('link', { name: 'Installation', exact: true })).toBeEnabled()
})
