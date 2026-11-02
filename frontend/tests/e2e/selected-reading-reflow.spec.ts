import { writeFile } from 'node:fs/promises'
import { test, expect } from './browser.ts'

import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

test('persisted Selected Reading numbers and units reflow intact at 200% text enlargement', async ({ page, request, browser }, testInfo) => {
  test.setTimeout(60_000)
  const { asOf } = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const reference = Math.floor(Date.parse(asOf) / 60_000) * 60_000
  const rows = []
  for (const [minutes, solarPowerW, consumptionPowerW, batteryStateOfChargePercent] of [
    [120, 0, 0, 0], [60, 12345.67, 98765.43, 100], [1, 1200, 800, 65],
  ]) {
    const result = await request.post('http://127.0.0.1:5181/api/readings', { data: {
      installationId: 'residential-demo', measuredAt: new Date(reference - minutes * 60_000).toISOString(),
      solarPowerW, consumptionPowerW, batteryStateOfChargePercent,
    } })
    expect(result.status()).toBe(201)
    rows.push((await result.json()).reading)
  }
  const evidence: Array<Record<string, unknown>> = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  async function textSize(multiplier: number) {
    await page.evaluate(multiplier => {
      for (const element of document.querySelectorAll<HTMLElement>('[data-f2-size]')) {
        element.style.removeProperty('font-size'); element.removeAttribute('data-f2-size')
      }
      // HTML text enlargement only: not native zoom, SVG scaling or a reader trial.
      const text = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(element => element instanceof HTMLElement && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
        .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }))
      for (const { element, size } of text) {
        element.dataset.f2Size = 'true'; element.style.fontSize = `${size * multiplier}px`
      }
    }, multiplier)
  }
  async function metrics() {
    return page.locator('.context-values dd').evaluateAll(elements => elements.map(element => {
      const number = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) ?? element.querySelector('span')!.firstChild!
      const range = document.createRange(); range.selectNodeContents(number)
      const rects = [...range.getClientRects()]
      const box = element.getBoundingClientRect()
      const unit = element.querySelector('small')!.getBoundingClientRect()
      const metric = element.parentElement!.getBoundingClientRect()
      return { value: number.textContent!.trim(), unit: element.querySelector('small')!.textContent,
        lines: new Set(rects.map(rect => Math.round(rect.y))).size,
        fontSize: parseFloat(getComputedStyle(element).fontSize),
        fits: rects.every(rect => rect.left >= metric.left - 1 && rect.right <= metric.right + 1) && unit.right <= metric.right + 1,
        sameLine: unit.top < Math.max(...rects.map(rect => rect.bottom)) && unit.bottom > Math.min(...rects.map(rect => rect.top)),
        width: box.width, row: metric.y }
    }))
  }
  async function inspect(label: string) {
    const values = await metrics()
    evidence.push({ label, viewport: page.viewportSize(), values })
    expect(values.map(value => value.lines), label).toEqual([1, 1, 1])
    expect(values.every(value => value.fits && value.sameLine), `${label}: intact value/unit pairs fit`).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: page reflow`).toBe(true)
    expect(await page.locator('.history-context').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  }
  async function select(key: string, at: string) {
    await page.getByTestId('power-plot').focus()
    await page.keyboard.press(key)
    await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', at)
  }
  async function capture(name: string) {
    await page.locator('.history-heading h1').click()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(name), fullPage: true })
  }
  try {
    await page.setViewportSize({ width: 390, height: 667 })
    const history = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
    await page.goto('/#history')
    const persisted = await (await history).json()
    expect(persisted.readings.map((row: { measuredAt: string }) => row.measuredAt)).toEqual(rows.map(row => row.measuredAt))
    await expect(page.getByTestId('history-selected-solar')).toHaveText('1,200W')
    await page.evaluate(() => document.fonts.ready)
    await textSize(2)
    await capture('history-200.png')
    await inspect('original-390x667-1200')
    for (const size of [{ width: 360, height: 640 }, { width: 390, height: 667 }, { width: 430, height: 844 }, { width: 667, height: 375 }, { width: 1440, height: 1186 }, { width: 320, height: 640 }]) {
      await textSize(1)
      await page.setViewportSize(size)
      await select('End', rows[2].measuredAt)
      const normal = await metrics()
      await inspect(`normal-${size.width}`)
      if (size.width <= 430 && size.width >= 360) expect(new Set(normal.map(value => value.row)).size).toBe(1)
      if (size.width === 390 || size.width === 1440) {
        await capture(`history-normal-${size.width}.png`)
      }
      await textSize(2)
      await inspect(`200%-${size.width}-original`)
      const enlarged = await metrics()
      expect(enlarged.map(value => value.fontSize)).toEqual(normal.map(value => value.fontSize * 2))
      await select('Home', rows[0].measuredAt)
      await expect(page.getByTestId('history-selected-solar')).toHaveText('0W')
      await expect(page.getByTestId('history-selected-battery')).toHaveText('0%')
      await inspect(`200%-${size.width}-zero`)
      await select('ArrowRight', rows[1].measuredAt)
      await expect(page.getByTestId('history-selected-solar')).toHaveText('12,345.67W')
      await expect(page.getByTestId('history-selected-consumption')).toHaveText('98,765.43W')
      await expect(page.getByTestId('history-selected-battery')).toHaveText('100%')
      await inspect(`200%-${size.width}-large`)
      if (size.width === 390) await capture('history-large-200.png')
      await page.getByRole('button', { name: 'Next minute', exact: true }).click()
      await expect(page.locator('.selection-message')).toHaveText('No measurement in this minute.')
      await expect(page.getByTestId('history-selected-solar')).toHaveText('—W')
      await expect(page.getByTestId('history-selected-battery')).toHaveText('—%')
      await inspect(`200%-${size.width}-unavailable`)
      if (size.width === 390) await capture('history-unavailable-200.png')
    }
  } finally {
    const destination = testInfo.outputPath('selected-reading-reflow.json')
    await writeFile(destination, JSON.stringify({ method: 'HTML text enlargement, DOM Range geometry and real PostgreSQL -> API -> React; not native zoom or spoken reader output', browser: browser.version(), readings: rows, cases: evidence }, null, 2))
    await testInfo.attach('selected-reading-reflow.json', { path: destination, contentType: 'application/json' })
  }
})
