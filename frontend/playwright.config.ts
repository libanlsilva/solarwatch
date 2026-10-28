import { defineConfig, devices } from '@playwright/test'

const connection = process.env.SOLARWATCH_E2E_CONNECTION
if (!connection || !/(?:^|;)Database=[^;]*_e2e(?:;|$)/i.test(connection)) {
  throw new Error(
    'Set SOLARWATCH_E2E_CONNECTION to a dedicated PostgreSQL database ending in _e2e. Tests clear its demo readings.',
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4181',
    trace: 'retain-on-failure',
    timezoneId: 'America/Havana',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } }],
  webServer: [
    {
      command:
        'dotnet run --project ../backend/src/SolarWatch.Api --configuration Release --no-build --no-launch-profile',
      url: 'http://127.0.0.1:5181/openapi/v1.json',
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: 'http://127.0.0.1:5181',
        ConnectionStrings__SolarWatch: connection,
      },
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4181 --strictPort',
      url: 'http://127.0.0.1:4181',
      reuseExistingServer: false,
      env: { SOLARWATCH_API_URL: 'http://127.0.0.1:5181' },
    },
  ],
})
