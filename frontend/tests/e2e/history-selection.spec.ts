import { test, expect, boundExternalFonts } from './browser.ts'
import type { APIRequestContext, Page } from '@playwright/test'
import { command } from './development.ts'
import { utcMicroseconds } from '../../src/history.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

async function persist(request: APIRequestContext, measuredAt: string, solarPowerW = 0, consumptionPowerW = 0, batteryStateOfChargePercent = 0) {
  const response = await request.post('http://127.0.0.1:5181/api/readings', { data: { installationId: 'residential-demo', measuredAt, solarPowerW, consumptionPowerW, batteryStateOfChargePercent } })
  expect(response.status()).toBe(201)
  return (await response.json()).reading
}

async function seed(request: APIRequestContext) {
  const { asOf } = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const minute = Math.floor(Date.parse(asOf) / 60_000) * 60_000
  const stamp = (hours: number, fraction = '123456') => `${new Date(minute - hours * 3_600_000).toISOString().slice(0, 19)}.${fraction}Z`
  return [
    await persist(request, stamp(23)),
    await persist(request, stamp(18), 900, 350, 20),
    await persist(request, stamp(12, '000001'), 1500, 750, 50),
    await persist(request, stamp(12, '000002'), 1500, 750, 50),
    await persist(request, stamp(1), 3000, 1200, 80),
  ]
}

async function selectPoint(page: Page, at: string, series = 'solar', touch = false) {
  const point = page.locator(`.history-point[data-series="${series}"][data-measured-at="${at}"]`)
  await point.scrollIntoViewIfNeeded()
  const box = (await point.boundingBox())!
  if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

async function assertSelected(page: Page, row: { measuredAt: string; solarPowerW: number; consumptionPowerW: number; batteryStateOfChargePercent: number }) {
  await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', row.measuredAt)
  await expect(page.getByTestId('history-selected-solar')).toHaveText(`${row.solarPowerW.toLocaleString('en-US')}W`)
  await expect(page.getByTestId('history-selected-consumption')).toHaveText(`${row.consumptionPowerW.toLocaleString('en-US')}W`)
  await expect(page.getByTestId('history-selected-battery')).toHaveText(`${row.batteryStateOfChargePercent}%`)
  for (const [series, value] of [['solar', row.solarPowerW], ['consumption', row.consumptionPowerW], ['battery', row.batteryStateOfChargePercent]] as const) {
    await expect(page.locator(`.selection-marker[data-series="${series}"]`)).toHaveAttribute('data-measured-at', row.measuredAt)
    await expect(page.locator(`.selection-marker[data-series="${series}"]`)).toHaveAttribute('data-value', String(value))
  }
  const cursors = await page.locator('.history-plot').evaluateAll(plots => plots.map(plot => {
    const line = plot.querySelector('.selection-cursor')!
    const target = plot.querySelector('.history-inspection-target')!
    return (Number(line.getAttribute('x1')) - Number(target.getAttribute('x'))) / Number(target.getAttribute('width'))
  }))
  expect(cursors).toHaveLength(2)
  expect(cursors[0]).toBeCloseTo(cursors[1], 9)
}

test('mouse and keyboard share exact PostgreSQL observations across plots/panel, preserving zero and no extra queries', async ({ page, request }) => {
  const rows = await seed(request)
  let queries = 0
  page.on('request', request => { if (request.url().endsWith('/api/readings/history')) queries++ })
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.goto('/#history')
  await expect(page.locator('.selection-marker')).toHaveCount(3)
  await selectPoint(page, rows[1].measuredAt)
  await assertSelected(page, rows[1])
  await selectPoint(page, rows[0].measuredAt, 'battery')
  await assertSelected(page, rows[0])
  await page.getByTestId('power-plot').focus()
  await page.keyboard.press('ArrowRight')
  await assertSelected(page, rows[1])
  await page.keyboard.press('ArrowRight')
  await assertSelected(page, rows[2])
  await expect(page.locator('.selection-message')).toContainText('Exact observation. 2 readings')
  await page.keyboard.press('ArrowRight')
  await assertSelected(page, rows[3])
  await page.keyboard.press('ArrowLeft')
  await assertSelected(page, rows[2])
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Previous minute', exact: true }).focus()
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await assertSelected(page, rows[2])
  }
  expect(queries).toBe(1)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('ambiguous pixel hits inspect a minute; slider/UTC steps expose gaps and exact keyboard activation preserves the earlier microsecond row', async ({ page, request }) => {
  const rows = await seed(request)
  await page.setViewportSize({ width: 390, height: 667 })
  await page.goto('/#history')
  await expect(page.locator('.selection-marker')).toHaveCount(3)
  await selectPoint(page, rows[2].measuredAt)
  await assertSelected(page, rows[3])
  await expect(page.getByTestId('power-plot')).toHaveAttribute('data-selection-mode', 'minute')
  await expect(page.locator('.selection-message')).toContainText('2 readings in this minute; showing the latest measured time')
  await expect(page.locator('.selection-notice')).toContainText('Points overlap')
  const slider = page.getByRole('slider', { name: 'Inspected UTC minute' })
  await slider.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
  await expect(page.locator('.selection-marker')).toHaveCount(0)
  await expect(page.locator('.selection-cursor.unavailable')).toHaveCount(2)
  await expect(page.getByTestId('history-selected-solar')).toHaveText('—W')
  await page.keyboard.press('ArrowRight')
  await assertSelected(page, rows[3])
  await page.getByTestId('battery-plot').focus()
  await page.keyboard.press('ArrowLeft')
  await assertSelected(page, rows[2])
  await expect(page.getByTestId('power-plot')).toHaveAttribute('data-selection-mode', 'observation')
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(page.getByRole('button', { name: 'Previous minute', exact: true })).toBeDisabled()
  await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
  await page.keyboard.press('End')
  await expect(page.getByRole('button', { name: 'Next minute', exact: true })).toBeDisabled()
  await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
  await expect(slider).toHaveAttribute('aria-valuetext', /America\/Havana/)
})

test('Refresh success/failure reconcile the user selection changed while pending, and successful empty clears it', async ({ page, request }) => {
  const rows = await seed(request)
  await page.goto('/#history')
  await expect(page.locator('.selection-marker')).toHaveCount(3)
  const reference = await page.getByTestId('history-asof').getAttribute('datetime')
  let release!: () => void
  let gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/readings/history', async route => { await gate; await route.continue() })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await page.getByTestId('power-plot').focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await assertSelected(page, rows[1])
  const now = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const fresh = await persist(request, now.asOf, 1777, 888, 60)
  release()
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeEnabled()
  await expect(page.getByTestId('history-asof')).not.toHaveAttribute('datetime', reference!)
  await expect(page.locator('.history-point[data-series="solar"]').last()).toHaveAttribute('data-measured-at', fresh.measuredAt)
  await assertSelected(page, rows[1])
  const retainedAsOf = await page.getByTestId('history-asof').getAttribute('datetime')
  const retainedRange = await page.getByTestId('history-window').innerHTML()
  await page.unroute('**/api/readings/history')
  gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/readings/history', async route => { await gate; await route.abort() })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await page.getByRole('button', { name: 'Next minute', exact: true }).click()
  await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
  const selectedMinute = await page.getByTestId('power-plot').getAttribute('data-selection-at')
  release()
  await expect(page.getByRole('alert')).toContainText('Previous history is still available')
  await expect(page.getByTestId('power-plot')).toHaveAttribute('data-selection-at', selectedMinute!)
  await expect(page.getByTestId('history-asof')).toHaveAttribute('datetime', retainedAsOf!)
  expect(await page.getByTestId('history-window').innerHTML()).toBe(retainedRange)
  command('clear-demo', '--confirm')
  await page.unroute('**/api/readings/history')
  await page.getByRole('button', { name: 'History Retry', exact: true }).click()
  await expect(page.locator('.history-workspace')).toHaveAttribute('data-history-state', 'empty')
  await expect(page.getByTestId('history-selected-time')).toHaveCount(0)
  await expect(page.getByTestId('history-inspected-time')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next minute', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Previous minute', exact: true })).toBeDisabled()
})

test('a new row recomputes minute-default selection; removal of an exact row keeps unavailable identity instead of borrowing its neighbor', async ({ page, request }) => {
  const rows = await seed(request)
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.goto('/#history')
  await expect(page.locator('.selection-marker')).toHaveCount(3)
  await selectPoint(page, rows[2].measuredAt)
  await assertSelected(page, rows[3])
  const third = await persist(request, rows[3].measuredAt.replace('000002', '000003'), 1600, 800, 55)
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await assertSelected(page, third)
  await expect(page.locator('.selection-message')).toContainText('3 readings in this minute')
  await page.getByTestId('power-plot').focus()
  await page.keyboard.press('ArrowLeft')
  await assertSelected(page, rows[3])
  command('clear-demo', '--confirm')
  await persist(request, third.measuredAt, third.solarPowerW, third.consumptionPowerW, third.batteryStateOfChargePercent)
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByTestId('history-inspected-time')).toHaveAttribute('datetime', rows[3].measuredAt)
  await expect(page.getByTestId('history-selected-time')).toHaveCount(0)
  await expect(page.locator('.selection-message')).toContainText('Selected instant is not present in this response')
  await expect(page.locator('.selection-marker')).toHaveCount(0)
  await expect(page.getByTestId('history-selected-solar')).toHaveText('—W')
})

test('real captures, keyboard focus, responsive geometry and short-height reachability match the approved interactive composition', async ({ page, request }, testInfo) => {
  const rows = await seed(request)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1186 })
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
  await page.goto('/#history')
  const snapshot = await (await loaded).json()
  await expect(page.locator('.selection-marker')).toHaveCount(3)
  await selectPoint(page, rows[1].measuredAt)
  await assertSelected(page, rows[1])
  const position = await page.locator('.power-detail .selection-cursor').getAttribute('x1')
  const area = page.locator('.power-detail .history-inspection-target')
  const expected = Number(utcMicroseconds(rows[1].measuredAt) - utcMicroseconds(snapshot.from)) / Number(utcMicroseconds(snapshot.to) - utcMicroseconds(snapshot.from))
  expect((Number(position) - Number(await area.getAttribute('x'))) / Number(await area.getAttribute('width'))).toBeCloseTo(expected, 9)
  await page.evaluate(() => document.fonts.ready)
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 900 ? 844 : 1186 })
    await expect.poll(() => page.locator('.card, .detail-chart, .app-header').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className)), { message: `overflow at ${width}` }).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await assertSelected(page, rows[1])
    expect(await page.locator('nav a,.refresh,.minute-controls button').evaluateAll(elements => elements.every(element => element.getBoundingClientRect().height >= 44 && element.getBoundingClientRect().width >= 44))).toBe(true)
  }
  await page.getByRole('button', { name: 'Previous minute', exact: true }).focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Previous minute', exact: true })).toHaveCSS('outline-style', 'solid')
  const footprints = []
  for (const size of [{ width: 360, height: 640 }, { width: 390, height: 667 }]) {
    await page.setViewportSize(size)
    await expect(page.locator('.history-context')).toHaveCSS('position', 'static')
    await page.getByTestId('power-plot').scrollIntoViewIfNeeded()
    const header = (await page.locator('.app-header').boundingBox())!
    const plot = (await page.getByTestId('power-plot').boundingBox())!
    const context = (await page.locator('.history-context').boundingBox())!
    footprints.push({ viewport: size, stickyHeader: header.height, scrollingContext: context.height, powerPlot: plot.height, availableBelowHeader: size.height - header.height })
    expect(plot.y).toBeGreaterThanOrEqual(header.y + header.height)
    expect(plot.y + plot.height).toBeLessThanOrEqual(size.height)
  }
  await testInfo.attach('short-phone-footprints.json', { body: JSON.stringify(footprints, null, 2), contentType: 'application/json' })
  console.log(`History short-phone footprints: ${JSON.stringify(footprints)}`)
  async function capture(state: string) {
    await page.setViewportSize({ width: 1440, height: 1186 })
    await page.getByRole('heading', { name: 'History', exact: true }).click()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(() => page.locator('.power-detail .history-inspection-target').getAttribute('width').then(Number)).toBeGreaterThan(600)
    await page.screenshot({ path: testInfo.outputPath(`history-interactive-${state}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => page.locator('.power-detail .history-inspection-target').getAttribute('width').then(Number)).toBeLessThan(390)
    await page.screenshot({ path: testInfo.outputPath(`history-interactive-${state}-mobile.png`) })
    await page.screenshot({ path: testInfo.outputPath(`history-interactive-${state}-mobile-full.png`), fullPage: true })
  }
  await capture('selected')
  await page.getByRole('button', { name: 'Next minute', exact: true }).click()
  await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
  await capture('missing')
  for (const width of [360, 390, 768, 1440]) {
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-text-enlarged]').forEach(element => { element.style.removeProperty('font-size'); element.removeAttribute('data-text-enlarged') }))
    await page.setViewportSize({ width, height: 844 })
    // Text-only enlargement, including fixed-pixel HTML labels. This does not
    // claim native browser zoom, SVG text zoom or screen-reader validation.
    await page.evaluate(() => {
      const text = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(element => element instanceof HTMLElement && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
        .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }))
      for (const { element, size } of text) { element.style.fontSize = `${size * 2}px`; element.dataset.textEnlarged = 'true' }
    })
    await expect.poll(() => page.locator('.card, .app-header').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className)), { message: `200% text overflow at ${width}` }).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width <= 900) await expect(page.locator('.history-context')).toHaveCSS('position', 'static')
  }
})

test('actual touchscreen point/minute activation synchronizes both graphs and keeps selection while scrolling', async ({ browser, request }) => {
  const rows = await seed(request)
  const context = await browser.newContext({ viewport: { width: 390, height: 667 }, hasTouch: true, isMobile: true, timezoneId: 'America/Havana', reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await boundExternalFonts(page)
    await page.goto('http://127.0.0.1:4181/#history')
    await expect(page.locator('.selection-marker')).toHaveCount(3)
    await selectPoint(page, rows[1].measuredAt, 'solar', true)
    await assertSelected(page, rows[1])
    await page.getByRole('button', { name: 'Next minute', exact: true }).tap()
    await expect(page.locator('.selection-cursor.unavailable')).toHaveCount(2)
    await expect(page.getByTestId('history-selected-solar')).toHaveText('—W')
    await selectPoint(page, rows[2].measuredAt, 'battery', true)
    await assertSelected(page, rows[3])
    await expect(page.getByTestId('power-plot')).toHaveAttribute('data-selection-mode', 'minute')
    await expect(page.locator('.selection-notice')).toContainText('Points overlap')
    await page.locator('.history-coverage').scrollIntoViewIfNeeded()
    await assertSelected(page, rows[3])
  } finally { await context.close() }
})
