import { test, expect, boundExternalFonts } from './browser.ts'
import type { APIRequestContext } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

async function persist(request: APIRequestContext, measuredAt: string, value = 1777) {
  const response = await request.post('http://127.0.0.1:5181/api/readings', { data: {
    installationId: 'residential-demo', measuredAt, solarPowerW: value, consumptionPowerW: value / 2, batteryStateOfChargePercent: 60,
  } })
  expect(response.status()).toBe(201)
  return (await response.json()).reading
}

async function seed(request: APIRequestContext) {
  const { asOf } = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const start = Math.floor(Date.parse(asOf) / 60_000) * 60_000 - 23 * 60 * 60_000
  const rows = []
  for (const [index, minutes] of [0, 1, 4, 9, 40, 1370].entries()) {
    rows.push(await persist(request, `${new Date(start + minutes * 60_000).toISOString().slice(0, 19)}.123456Z`, index * 600))
  }
  return rows
}

test('direct History, reload and Back/Forward share one history snapshot; context never borrows Latest', async ({ page, request }) => {
  const rows = await seed(request)
  const calls = { latest: 0, history: 0 }
  page.on('request', request => {
    if (request.url().endsWith('/api/readings/latest')) calls.latest++
    if (request.url().endsWith('/api/readings/history')) calls.history++
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#history')
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible()
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
  await expect(page.locator('.history-point[data-series="solar"]')).toHaveCount(6)
  expect(calls).toEqual({ latest: 0, history: 1 })
  const originalAsOf = await page.getByTestId('history-asof').getAttribute('datetime')
  const now = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const newRow = await persist(request, now.asOf)
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByTestId('solar-power')).toHaveText('1,777 W')
  await page.goBack()
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
  await expect(page.getByTestId('history-asof')).toHaveAttribute('datetime', originalAsOf!)
  expect(calls).toEqual({ latest: 1, history: 1 })
  await page.goForward()
  await expect(page.getByRole('heading', { name: /Your home/ })).toBeVisible()
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', newRow.measuredAt)
  await expect(page.getByTestId('history-latest-solar')).toHaveText('1,777W')
  expect(calls).toEqual({ latest: 1, history: 2 })
  await page.getByRole('link', { name: 'Installation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your installation' })).toBeInViewport()
  await page.goBack()
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.reload()
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', newRow.measuredAt)
  expect(calls).toEqual({ latest: 1, history: 3 })
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Selected reading', exact: true })).toHaveCount(0)
})

test('History Refresh is single-flight; failures retain the complete snapshot and successful empty clears it', async ({ page, request }) => {
  const rows = await seed(request)
  let historyCalls = 0
  page.on('request', request => { if (request.url().endsWith('/api/readings/history')) historyCalls++ })
  await page.goto('/#history')
  await expect(page.getByTestId('history-latest-time')).toBeVisible()
  const reference = await page.getByTestId('history-asof').getAttribute('datetime')
  const range = await page.getByTestId('history-window').innerHTML()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/readings/history', async route => { await gate; await route.fulfill({ status: 503, body: 'Unavailable' }) })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('Refreshing history')
  await page.getByRole('button', { name: 'Refreshing…' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  expect(historyCalls).toBe(2)
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
  // Navigating while this same query is in flight neither aborts it nor creates a second owner.
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
  await page.getByRole('link', { name: 'History', exact: true }).click()
  expect(historyCalls).toBe(2)
  release()
  await expect(page.getByRole('alert')).toContainText('Previous history is still available')
  await expect(page.getByTestId('history-asof')).toHaveAttribute('datetime', reference!)
  expect(await page.getByTestId('history-window').innerHTML()).toBe(range)
  await expect(page.locator('.history-point[data-series="solar"]')).toHaveCount(6)
  command('clear-demo', '--confirm')
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry', exact: true }).click()
  await expect(page.locator('.history-workspace')).toHaveAttribute('data-history-state', 'empty')
  await expect(page.getByTestId('history-latest-time')).toHaveCount(0)
  await expect(page.locator('.history-point')).toHaveCount(0)
  await expect(page.locator('.history-context')).toContainText('No reading available')
  await expect(page.locator('.history-coverage')).toContainText('0 recorded measurements')
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByTestId('solar-power')).toHaveText('3,000 W')
})

test('initial loading/error/retry have no fake metadata or values and page reload cancels obsolete work', async ({ page, request }) => {
  await seed(request)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let held = true
  await page.route('**/api/readings/history', async route => { if (held) await gate; await route.abort() })
  await page.goto('/#history')
  await expect(page.locator('.history-workspace')).toHaveAttribute('data-history-state', 'pending')
  await expect(page.getByTestId('history-asof')).toHaveCount(0)
  await expect(page.getByTestId('history-latest-solar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  held = false
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('History could not be loaded')
  release()
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry', exact: true }).click()
  await expect(page.getByTestId('history-latest-solar')).toHaveText('3,000W')
  await expect(page.locator('.history-workspace')).toHaveAttribute('data-history-state', 'ready')
})

test('real partial History stays legible at all approved widths, on short phones and with keyboard/touch', async ({ page, request }, testInfo) => {
  const rows = await seed(request)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.goto('/#history')
  await expect(page.locator('.history-point[data-series="solar"]')).toHaveCount(6)
  await expect(page.locator('.coverage-pill')).toHaveText('Partial history')
  await expect(page.locator('.power-detail .history-gap')).toHaveCount(4)
  await expect(page.locator('.coverage-intervals time').first()).toHaveAttribute('datetime', await page.getByTestId('history-window').locator('time').first().getAttribute('datetime') as string)
  const coordinates = await page.locator('.history-point[data-series="solar"]').evaluateAll(elements => elements.map(element => Number(element.getAttribute('cx'))))
  expect((coordinates[2] - coordinates[1]) / (coordinates[1] - coordinates[0])).toBeCloseTo(3, 5)
  await expect(page.locator('.history-point[data-series="solar"]').first()).toHaveAttribute('data-value', '0')
  const path = await page.locator('.solar-series .recharts-area-curve').getAttribute('d')
  expect(path!.match(/M/g)).toHaveLength(3)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath('history-partial-desktop.png'), fullPage: true })
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 1186 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect.poll(() => page.locator('.card, .detail-chart, .app-header').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className)), { message: `overflow at ${width}` }).toEqual([])
    const controls = await page.locator('nav a, .refresh').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).every(rect => rect.width >= 44 && rect.height >= 44))
    expect(controls).toBe(true)
  }
  const shortPhoneLayouts = []
  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 667 }]) {
    await page.setViewportSize(size)
    await expect(page.locator('.history-context')).toHaveCSS('position', 'static')
    await page.getByTestId('power-plot').scrollIntoViewIfNeeded()
    const header = await page.locator('.app-header').boundingBox()
    const plot = await page.getByTestId('power-plot').boundingBox()
    expect(plot!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
    expect(plot!.y + plot!.height).toBeLessThanOrEqual(size.height)
    shortPhoneLayouts.push({ ...size, headerHeight: header!.height, contextHeight: (await page.locator('.history-context').boundingBox())!.height, plotHeight: plot!.height, spaceBelowHeader: size.height - header!.height })
  }
  const layoutPath = testInfo.outputPath('short-phone-layout.json')
  await writeFile(layoutPath, JSON.stringify(shortPhoneLayouts, null, 2))
  await testInfo.attach('short-phone-layout.json', { path: layoutPath, contentType: 'application/json' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.power-detail .recharts-surface').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.power-detail [role="tooltip"] time')).toHaveAttribute('datetime', rows[1].measuredAt)
  await page.keyboard.press('Escape')
  await expect(page.locator('.power-detail [role="tooltip"]')).toHaveCount(0)
  await page.locator('.battery-detail .recharts-surface').click({ position: { x: 95, y: 55 } })
  await expect(page.locator('.battery-detail [role="tooltip"]')).toBeVisible()
  await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
  await page.getByRole('link', { name: 'Overview', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'History', exact: true })).toBeFocused()
  await expect(page.getByRole('link', { name: 'History', exact: true })).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Installation', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeFocused()
  await page.getByRole('link', { name: 'Skip to content' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('history-partial-mobile.png') })
  await page.screenshot({ path: testInfo.outputPath('history-partial-mobile-full.png'), fullPage: true })
})

test('History chart inspection and navigation work with actual touchscreen input without changing read-only context', async ({ browser, request }) => {
  const rows = await seed(request)
  const context = await browser.newContext({ viewport: { width: 390, height: 667 }, isMobile: true, hasTouch: true, timezoneId: 'America/Havana', reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await boundExternalFonts(page)
    await page.goto('http://127.0.0.1:4181/#history')
    await expect(page.locator('.history-point[data-series="solar"]')).toHaveCount(6)
    await page.locator('.history-point[data-series="solar"]').last().tap()
    await expect(page.locator('.power-detail [role="tooltip"] time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
    await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
    await page.getByRole('link', { name: 'Installation', exact: true }).tap()
    await expect(page.getByRole('heading', { name: 'Your installation' })).toBeInViewport()
    await page.getByRole('link', { name: 'History', exact: true }).tap()
    await expect(page.getByTestId('history-latest-time')).toHaveAttribute('datetime', rows.at(-1).measuredAt)
  } finally { await context.close() }
})
