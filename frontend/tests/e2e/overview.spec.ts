import { test, expect } from '@playwright/test'
import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

test('approved Overview composition is responsive, navigable and backed by PostgreSQL', async ({ page }, testInfo) => {
  command('seed-demo')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await expect(page.locator('.hero-photo')).toHaveJSProperty('naturalWidth', 1672)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath('overview-desktop.png'), fullPage: true })

  await expect(page.getByRole('navigation')).toContainText('Coming later')
  await expect(page.getByRole('link', { name: /History/ })).toHaveCount(0)
  await expect(page.locator('.future-section')).toHaveAttribute('aria-disabled', 'true')
  await expect(page.locator('.history-pending svg, .history-pending canvas')).toHaveCount(0)
  await expect(page.getByText('History charts coming later', { exact: true })).toHaveCount(2)

  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 1186 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}`).toBe(true)
    const clipped = await page.locator('.card, .measurement-pair, .app-header').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className))
    expect(clipped, `card overflow at ${width}`).toEqual([])
    const controls = await page.locator('nav a, .refresh').evaluateAll((elements) => elements.map((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
    expect(controls.every((control) => control.width >= 44 && control.height >= 44)).toBe(true)
    await page.getByRole('link', { name: 'Installation', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Installation', exact: true })).toHaveAttribute('aria-current', 'location')
    await expect(page.getByRole('heading', { name: 'Your installation' })).toBeInViewport()
    const targetTop = await page.locator('#installation').evaluate((element) => element.getBoundingClientRect().top)
    const headerBottom = await page.locator('.app-header').evaluate((element) => element.getBoundingClientRect().bottom)
    if (width <= 900) expect(targetTop).toBeGreaterThanOrEqual(headerBottom)
    await page.getByRole('link', { name: 'Overview', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'location')
    await expect(page.getByRole('heading', { name: /Your home/ })).toBeInViewport()
  }
  await page.goBack()
  await expect(page.getByRole('link', { name: 'Installation', exact: true })).toHaveAttribute('aria-current', 'location')
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('overview-mobile.png') })
  await page.screenshot({ path: testInfo.outputPath('overview-mobile-full.png'), fullPage: true })
  await page.setViewportSize({ width: 360, height: 640 })
  await page.getByRole('link', { name: 'Installation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your installation' })).toBeInViewport()
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await page.getByRole('link', { name: 'Installation', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeFocused()
  const focus = await page.getByRole('button', { name: 'Refresh readings' }).evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(focus).toBe('solid')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('link', { name: 'Installation', exact: true })).toBeFocused()
})

test('refresh keeps the last snapshot and server reference, with no duplicate or automatic requests', async ({ page }) => {
  command('seed-demo')
  let requests = 0
  page.on('request', (request) => { if (request.url().endsWith('/api/readings/latest')) requests++ })
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  expect(requests).toBe(1)
  const reference = await page.getByTestId('checked-at').getAttribute('datetime')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/readings/latest', async (route) => { await gate; await route.continue() })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('status')).toContainText('Refreshing readings')
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await page.getByRole('button', { name: 'Refreshing…' }).evaluate((element: HTMLButtonElement) => { element.click(); element.click() })
  expect(requests).toBe(2)
  await expect(page.getByTestId('checked-at')).toHaveAttribute('datetime', reference!)
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await page.clock.fastForward(10 * 60_000)
  await expect(page.getByText('Fresh at last check', { exact: true })).toBeVisible()
  expect(requests).toBe(2)
  release()
  await expect(page.getByRole('button', { name: 'Refresh readings' })).toBeEnabled()
  expect(requests).toBe(2)
})

test('a failed stale refresh retains its exact asOf and values; successful empty clears measurements', async ({ page }) => {
  command('seed-demo', '--measured-at', new Date(Date.now() - 8 * 60_000).toISOString())
  await page.goto('/')
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  const reference = await page.getByTestId('checked-at').getAttribute('datetime')
  const age = await page.locator('.checked p').nth(1).textContent()
  await page.route('**/api/readings/latest', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('alert')).toContainText('Current freshness could not be checked')
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await expect(page.getByTestId('checked-at')).toHaveAttribute('datetime', reference!)
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  await expect(page.locator('.checked p').nth(1)).toHaveText(age!)
  await page.unroute('**/api/readings/latest')
  command('clear-demo', '--confirm')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveCount(0)
  await expect(page.getByTestId('battery-charge')).toHaveCount(0)
  await expect(page.locator('time.measurement-timestamp')).toHaveCount(0)
  await expect(page.getByRole('meter')).toHaveCount(0)
  await expect(page.getByTestId('checked-at')).toBeVisible()
})

test('zero readings are real values, with a zero charge meter rather than unavailable data', async ({ page, request }) => {
  const reference = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const response = await request.post('http://127.0.0.1:5181/api/readings', { data: {
    installationId: 'residential-demo', measuredAt: reference.asOf,
    solarPowerW: 0, consumptionPowerW: 0, batteryStateOfChargePercent: 0,
  } })
  expect(response.status()).toBe(201)
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('0 W')
  await expect(page.getByTestId('consumption-power')).toHaveText('0 W')
  await expect(page.getByTestId('battery-charge')).toHaveText('0%')
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toHaveCount(0)
})

test('strict freshness boundary and reduced motion apply to the rendered components', async ({ page }) => {
  const measuredAt = '2026-10-28T18:32:00Z'
  let asOf = '2026-10-28T18:37:00Z'
  await page.clock.install({ time: new Date('2000-01-01T00:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/readings/latest', (route) => route.fulfill({ json: {
    asOf, reading: { installationId: 'residential-demo', measuredAt, solarPowerW: 1.5, consumptionPowerW: 2.5, batteryStateOfChargePercent: 100 },
  } }))
  await page.goto('/')
  await expect(page.getByText('Fresh at last check', { exact: true })).toBeVisible()
  await expect(page.getByTestId('battery-charge')).toHaveText('100%')
  asOf = '2026-10-28T18:37:00.001Z'
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  await page.unroute('**/api/readings/latest')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/readings/latest', async (route) => { await gate; await route.abort() })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.locator('.spinner')).toHaveCSS('animation-name', 'none')
  release()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('200 percent text enlargement remains readable without horizontal overflow', async ({ page }) => {
  command('seed-demo')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  for (const width of [360, 390, 768, 1440]) {
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-text-enlarged]').forEach((element) => { element.style.removeProperty('font-size'); element.removeAttribute('data-text-enlarged') }))
    await page.setViewportSize({ width, height: 844 })
    // Text-only enlargement of this breakpoint's styles, including fixed-pixel labels.
    // This is not a claim of native browser zoom or assistive-technology coverage.
    await page.evaluate(() => {
      const text = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => element instanceof HTMLElement && [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
        .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }))
      for (const { element, size } of text) { element.style.fontSize = `${size * 2}px`; element.dataset.textEnlarged = 'true' }
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow at ${width}`).toBe(true)
    const clipped = await page.locator('.card, .measurement-pair, .app-header').evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.className))
    expect(clipped, `200% text card overflow at ${width}`).toEqual([])
    await page.getByRole('link', { name: 'Installation', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your installation' })).toBeInViewport()
  }
})

test('latest states retain the approved hero notice placement on desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const stale = {
    asOf: '2026-10-28T18:39:30Z', reading: {
      installationId: 'residential-demo', measuredAt: '2026-10-28T18:32:00Z',
      solarPowerW: 1200, consumptionPowerW: 800, batteryStateOfChargePercent: 65,
    },
  }
  let phase: 'loading' | 'empty' | 'error' | 'stale' | 'refreshing' = 'loading'
  let release!: () => void
  let gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/readings/latest', async (route) => {
    if (phase === 'loading' || phase === 'refreshing') await gate
    if (phase === 'error') await route.abort()
    else await route.fulfill({ json: phase === 'empty' ? { asOf: stale.asOf, reading: null } : stale })
  })
  async function capture(name: string) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1186 })
      await expect(page.locator('.hero-copy')).toBeHidden()
      const notice = (await page.locator('.state-notice').boundingBox())!
      const power = (await page.locator('.metric-pair').boundingBox())!
      expect(notice.y + notice.height, `${name} notice overlap at ${width}`).toBeLessThanOrEqual(power.y)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true })
    }
  }
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Loading latest reading…' })).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveCount(0)
  await capture('loading')
  phase = 'empty'
  release()
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  await capture('empty')
  phase = 'error'
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Unable to load readings')
  await capture('error')
  phase = 'stale'
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  await capture('stale')
  phase = 'refreshing'
  gate = new Promise<void>((resolve) => { release = resolve })
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  await capture('refreshing')
  phase = 'error'
  release()
  await expect(page.getByRole('alert')).toContainText('Current freshness could not be checked')
  await expect(page.getByTestId('checked-at')).toHaveAttribute('datetime', stale.asOf)
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await capture('retained')
})
