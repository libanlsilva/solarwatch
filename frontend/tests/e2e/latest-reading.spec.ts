import { execFileSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

function command(...args: string[]) {
  // Credentials are supplied through the environment, never command arguments or test output.
  try {
    execFileSync(
      'dotnet',
      [
        'run',
        '--project',
        '../backend/src/SolarWatch.Api',
        '--configuration',
        'Release',
        '--no-build',
        '--no-launch-profile',
        '--',
        ...args,
      ],
      {
        env: {
          ...process.env,
          ASPNETCORE_ENVIRONMENT: 'Development',
          ConnectionStrings__SolarWatch: process.env.SOLARWATCH_E2E_CONNECTION,
        },
        stdio: 'pipe',
        timeout: 60_000,
      },
    )
  } catch {
    throw new Error(
      `Development command failed: ${args[0]}. Check the dedicated E2E database and migration setup.`,
    )
  }
}

test.beforeAll(() => command('migrate'))
test.beforeEach(() => command('clear-demo', '--confirm'))

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
  await expect(page.getByText('Simulated data')).toBeVisible()
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
    page.getByRole('heading', { name: 'Latest reading', exact: true }),
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
