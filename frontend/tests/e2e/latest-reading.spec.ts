import { spawn, spawnSync } from 'node:child_process'
import { test, expect } from './browser.ts'
import { command } from './development.ts'

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

function simulate(args: string[] = [], expectedExit = 0) {
  const result = spawnSync('dotnet', [
      '../simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll',
      '--api-url', 'http://127.0.0.1:5181', '--count', '3', ...args,
    ], { encoding: 'utf8', timeout: 60_000, stdio: 'pipe' })
  expect(result.status, 'Simulator exit status against the local E2E API').toBe(expectedExit)
  return result.stdout
}

test('simulator ingests a finite batch and React discovers it only on manual refresh', async ({ page, request }) => {
  const reference = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const oldEnd = new Date(new Date(reference.asOf).getTime() - 6 * 60_000).toISOString()
  expect(simulate(['--end-at', oldEnd])).toContain('accepted=3, rejected=0, errors=0')
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  const previousTime = await page.locator('time').first().getAttribute('datetime')

  expect(simulate(['--seed', '43'])).toContain('accepted=3, rejected=0, errors=0')
  const latest = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  expect(new Date(latest.reading.measuredAt).getTime()).toBeGreaterThan(new Date(oldEnd).getTime())
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  expect(await page.locator('time').first().getAttribute('datetime')).toBe(previousTime)
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByText('Fresh at last check')).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
  await expect(page.getByTestId('consumption-power')).toHaveText(`${latest.reading.consumptionPowerW.toLocaleString('en-US')} W`)
  await expect(page.getByTestId('battery-charge')).toHaveText(`${latest.reading.batteryStateOfChargePercent}%`)
  await expect(page.locator(`time[datetime="${latest.reading.measuredAt}"]`)).toBeVisible()

  // A repeat of the controlled batch must report conflicts and leave the latest snapshot intact.
  const repeated = simulate(['--end-at', oldEnd], 1)
  expect(repeated).toContain('accepted=0, rejected=3, errors=0')
  expect(repeated.match(/HTTP 409/g)).toHaveLength(3)
  const after = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  expect(after.reading).toEqual(latest.reading)
})

test('continuous CLI persists its immediate sample and React discovers it on manual refresh', async ({ page, request }) => {
  test.setTimeout(45_000)
  const reference = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const oldEnd = new Date(new Date(reference.asOf).getTime() - 6 * 60_000).toISOString()
  simulate(['--end-at', oldEnd])
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  const previousTime = await page.locator('time').first().getAttribute('datetime')

  // Launch the actual executable without a dotnet-run wrapper or database credentials.
  const simulator = spawn('dotnet', [
    '../simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll',
    '--continuous', '--api-url', 'http://127.0.0.1:5181', '--seed', '43',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(SOLARWATCH_(E2E|TEST)_CONNECTION|ConnectionStrings__SolarWatch|POSTGRES_PASSWORD)$/i.test(key))),
  })
  let stdout = ''
  let stderr = ''
  simulator.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  simulator.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const exited = new Promise<number | null>((resolve) => {
    simulator.once('error', () => resolve(null))
    simulator.once('close', (code) => resolve(code))
  })
  try {
    await expect.poll(() => stdout, { timeout: 10_000 }).toContain('Accepted ')
    const latest = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
    expect(new Date(latest.reading.measuredAt).getTime()).toBeGreaterThan(new Date(oldEnd).getTime())
    await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
    expect(await page.locator('time').first().getAttribute('datetime')).toBe(previousTime)
    await page.getByRole('button', { name: 'Refresh readings' }).click()
    await expect(page.getByText('Fresh at last check')).toBeVisible()
    await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
    await expect(page.getByTestId('consumption-power')).toHaveText(`${latest.reading.consumptionPowerW.toLocaleString('en-US')} W`)
    await expect(page.getByTestId('battery-charge')).toHaveText(`${latest.reading.batteryStateOfChargePercent}%`)
    await expect(page.locator(`time[datetime="${latest.reading.measuredAt}"]`)).toBeVisible()

    // Node cannot deliver a console Ctrl+C event on Windows; Linux CI verifies the real SIGINT path.
    simulator.kill(process.platform === 'win32' ? 'SIGTERM' : 'SIGINT')
    await expect.poll(() => simulator.exitCode ?? simulator.signalCode, { timeout: 5_000 }).not.toBeNull()
    const code = await exited
    if (process.platform !== 'win32') {
      expect(code).toBe(0)
      expect(stdout).toContain('Stopped by operator. No write is pending.')
      expect(stdout).toContain('attempted=1, accepted=1, rejected=0, errors=0, uncertain=0')
    }
    expect(stderr).toBe('')
  } finally {
    if (simulator.exitCode === null && simulator.signalCode === null) simulator.kill('SIGKILL')
    await exited
  }
})

test('24-hour history CLI confirms 1441 minute samples and a full rerun conflicts without overwriting', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000)
  const reference = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const endAt = new Date(reference.asOf).toISOString()
  const end = Date.parse(endAt)
  const start = end - 24 * 60 * 60_000
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()

  function history(expectedExit: number) {
    const result = spawnSync('dotnet', [
      '../simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll',
      '--history-24h', '--end-at', endAt, '--seed', '42', '--api-url', 'http://127.0.0.1:5181',
    ], {
      encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024,
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        !/^(SOLARWATCH_(E2E|TEST)_CONNECTION|ConnectionStrings__SolarWatch|POSTGRES_PASSWORD)$/i.test(key))),
    })
    expect(result.status, 'History CLI exit status against actual API/PostgreSQL').toBe(expectedExit)
    expect(result.stderr).toBe('')
    return result.stdout
  }

  const output = history(0)
  expect(output).toContain('requested=1441, attempted=1441, accepted=1441, rejected=0, conflicts=0, errors=0, uncertain=0, unattempted=0')
  const accepted = [...output.matchAll(/^Accepted (\S+): solar=(\d+) W, consumption=(\d+) W, battery=(\d+)%/gm)]
  expect(accepted).toHaveLength(1441)
  for (const [index, sample] of accepted.entries()) {
    expect(Date.parse(sample[1])).toBe(start + index * 60_000)
  }
  expect(Date.parse(accepted[0][1])).toBe(start)
  expect(Date.parse(accepted.at(-1)![1])).toBe(end)
  const latest = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  const last = accepted.at(-1)!
  expect(latest.reading).toMatchObject({
    installationId: 'residential-demo', solarPowerW: Number(last[2]),
    consumptionPowerW: Number(last[3]), batteryStateOfChargePercent: Number(last[4]),
  })
  expect(Date.parse(latest.reading.measuredAt)).toBe(end)
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  const historyReceived = page.waitForResponse(response => response.url().endsWith('/api/readings/history'))
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  const plottedHistory = await (await historyReceived).json()
  await expect(page.getByText('Fresh at last check')).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
  await expect(page.getByTestId('consumption-power')).toHaveText(`${latest.reading.consumptionPowerW.toLocaleString('en-US')} W`)
  await expect(page.getByTestId('battery-charge')).toHaveText(`${latest.reading.batteryStateOfChargePercent}%`)
  await expect(page.locator(`time[datetime="${latest.reading.measuredAt}"]`)).toBeVisible()

  // Reuse this real 1,441-POST journey for full-data chart captures; no extra large setup run.
  await expect(page.locator('.solar-series .recharts-area-curve')).toBeVisible()
  await expect(page.locator('.consumption-series .recharts-line-curve')).toBeVisible()
  await expect(page.locator('.battery-series .recharts-area-curve')).toBeVisible()
  // A later live server window can exclude the earliest generated sample; every returned row is drawn.
  expect(plottedHistory.readings.length).toBeGreaterThan(1400)
  const solarPath = await page.locator('.solar-series .recharts-area-curve').getAttribute('d')
  expect(solarPath!.match(/[ML]/g)).toHaveLength(plottedHistory.readings.length)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => document.fonts.ready)
  await page.setViewportSize({ width: 1440, height: 1186 })
  await page.screenshot({ path: testInfo.outputPath('overview-charts-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('overview-charts-mobile.png') })
  await page.screenshot({ path: testInfo.outputPath('overview-charts-mobile-full.png'), fullPage: true })

  // The detailed screen reuses this persisted full-day snapshot; no second 1,441-POST setup.
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', plottedHistory.readings.at(-1).measuredAt)
  await expect(page.locator('.solar-series .recharts-area-curve')).toBeVisible()
  const detailPath = await page.locator('.solar-series .recharts-area-curve').getAttribute('d')
  expect(detailPath!.match(/[ML]/g)).toHaveLength(plottedHistory.readings.length)
  await page.getByRole('heading', { name: 'History', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1186 })
  await expect.poll(() => page.getByTestId('power-plot').evaluate(element => element.clientWidth)).toBeGreaterThan(600)
  await page.screenshot({ path: testInfo.outputPath('history-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.getByTestId('power-plot').evaluate(element => element.clientWidth)).toBeLessThan(390)
  await page.screenshot({ path: testInfo.outputPath('history-mobile.png') })
  await page.screenshot({ path: testInfo.outputPath('history-mobile-full.png'), fullPage: true })

  const repeated = history(1)
  expect(repeated).toContain('accepted=0, rejected=1441, conflicts=1441, errors=0, uncertain=0, unattempted=0')
  expect(repeated.match(/HTTP 409/g)).toHaveLength(1441)
  const after = await (await request.get('http://127.0.0.1:5181/api/readings/latest')).json()
  expect(after.reading).toEqual(latest.reading)
  const seconds = (value: string) => {
    const measured = Number(value.match(/elapsedSeconds=(\d+\.\d{3})\b/)![1])
    expect(Number.isFinite(measured)).toBeTruthy()
    return measured
  }
  console.log(`History E2E timings: fresh=${seconds(output)} s; repeat=${seconds(repeated)} s (1441 HTTP requests each).`)
})

test('persisted PostgreSQL fixture reaches React through the API despite a different browser clock', async ({
  page,
  request,
}) => {
  command('seed-demo')
  const response = await request.get(
    'http://127.0.0.1:5181/api/readings/latest',
  )
  expect(response.ok()).toBeTruthy()
  const snapshot = await response.json()
  expect(snapshot.reading).toMatchObject({
    installationId: 'residential-demo',
    solarPowerW: 1200,
    consumptionPowerW: 800,
    batteryStateOfChargePercent: 65,
  })
  await page.clock.install({ time: new Date('2040-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await expect(page.getByTestId('consumption-power')).toHaveText('800 W')
  await expect(page.getByTestId('battery-charge')).toHaveText('65%')
  await expect(page.getByRole('meter')).toHaveAttribute('aria-valuenow', '65')
  await expect(page.locator('.simulated:visible')).toHaveText('Simulated data')
  await expect(page.getByText('Fresh at last check')).toBeVisible()
  await expect(
    page.locator(`time[datetime="${snapshot.reading.measuredAt}"]`),
  ).toBeVisible()
  await expect(page.getByText('America/Havana', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByTestId('solar-power')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
})

test('empty database shows an empty state with no invented metrics or timestamp', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'No measurements yet' }),
  ).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveCount(0)
  await expect(page.getByText('Last measurement', { exact: true })).toHaveCount(
    0,
  )
  await page.route('**/api/readings/latest', (route) => route.abort())
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Readings are unavailable' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toHaveCount(0)
  await page.unroute('**/api/readings/latest')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
})

test('initial error can be retried against the real API', async ({ page }) => {
  command('seed-demo')
  await page.route('**/api/readings/latest', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Unable to load readings')
  await expect(page.getByTestId('solar-power')).toHaveCount(0)
  await page.unroute('**/api/readings/latest')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('loading is visible and a failed refresh clearly retains the previous reading until retry', async ({
  page,
}) => {
  command('seed-demo')
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/readings/latest', async (route) => {
    await gate
    await route.continue()
  })
  await page.route('**/api/readings/history', async (route) => { await gate; await route.continue() })
  await page.goto('/')
  await expect(page.getByText('Loading latest reading…')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  release()
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await page.unroute('**/api/readings/latest')
  await page.route('**/api/readings/latest', (route) => route.abort())
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'has not been verified again',
  )
  await expect(
    page.getByRole('heading', { name: 'Previous reading' }),
  ).toBeVisible()
  await expect(page.getByTestId('solar-power')).toHaveText('1,200 W')
  await page.unroute('**/api/readings/latest')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Latest measurement', exact: true }),
  ).toBeVisible()
})

test('controlled old readings are stale and manual refresh discovers a new persisted reading', async ({
  page,
}) => {
  const oldTime = new Date(Date.now() - 6 * 60_000).toISOString()
  command('seed-demo', '--measured-at', oldTime)
  await page.clock.install({ time: new Date('2000-01-01T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByText('Stale reading', { exact: true })).toBeVisible()
  await expect(page.getByTestId('battery-charge')).toHaveText('65%')
  command('seed-demo')
  await page.getByRole('button', { name: 'Refresh readings' }).click()
  await expect(page.getByText('Fresh at last check')).toBeVisible()
  await expect(page.getByText('Stale reading', { exact: true })).toHaveCount(0)
})
