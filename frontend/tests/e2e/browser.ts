import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Functional tests must not wait indefinitely for the optional external font service.
// Successful responses retain the real font; unavailable fonts use the application's declared fallback.
export async function boundExternalFonts(page: Page) {
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
    await page.route(`https://${host}/**`, async route => {
      try {
        const response = await route.fetch({ timeout: 3000, maxRetries: 0 })
        await route.fulfill({ response })
      } catch { await route.abort('timedout').catch(() => { /* The page may already have closed during teardown. */ }) }
    })
  }
}

export const test = base.extend({ page: async ({ page }, use) => {
  await boundExternalFonts(page)
  await use(page)
} })
export { expect }
