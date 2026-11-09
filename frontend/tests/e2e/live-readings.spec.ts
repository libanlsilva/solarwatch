import { test, expect } from './browser.ts'

test('a reading posted to the API appears on the Overview without Refresh', async ({ page, request }) => {
  await page.addInitScript(() => window.localStorage.setItem('solarwatch.live', 'on'))
  await page.goto('/#overview')
  await expect(page.getByTestId('live-toggle')).toContainText('Live', { timeout: 15_000 })
  await expect(page.getByTestId('live-toggle')).not.toContainText('Connecting')
  const measuredAt = new Date().toISOString()
  const response = await request.post('http://127.0.0.1:5181/api/readings', {
    data: { installationId: 'residential-demo', measuredAt, solarPowerW: 3210, consumptionPowerW: 1234, batteryStateOfChargePercent: 64.5, gridVoltageV: 231.2 },
  })
  expect(response.ok()).toBeTruthy()
  await expect(page.getByTestId('solar-power')).toHaveText('3,210 W')
  await expect(page.getByTestId('consumption-power')).toHaveText('1,234 W')
  await expect(page.getByTestId('electrical-panel')).toContainText('231.2')
  await expect(page.getByTestId('live-chart')).toBeVisible()
})

test('pausing live keeps the manual refresh behaviour', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('solarwatch.live', 'on'))
  await page.goto('/#overview')
  const toggle = page.getByTestId('live-toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toContainText('Live paused')
})
