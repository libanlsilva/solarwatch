import { writeFile } from 'node:fs/promises'
import { test, expect } from './browser.ts'
import { command } from './development.ts'

const guidance = 'A request is in progress. Refresh updates only resources without a pending request.'
function hold(fail = false) {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  return { gate, release, fail }
}

test.beforeAll(() => command('migrate'))
test.beforeEach(() => { command('clear-demo', '--confirm'); command('seed-demo') })

test('Refresh exposes one accurate AX description only while another resource remains available', async ({ page, request, browser }, testInfo) => {
  const response = await request.get('http://127.0.0.1:5181/api/readings/latest')
  expect(response.status()).toBe(200)
  const persisted = (await response.json()).reading
  let latest = hold(), history = hold()
  const calls = { latest: 0, history: 0 }
  await page.route('**/api/readings/latest', async route => {
    const planned = latest; calls.latest++
    await planned.gate
    if (planned.fail) await route.abort(); else await route.continue()
  })
  await page.route('**/api/readings/history', async route => {
    const planned = history; calls.history++
    await planned.gate
    if (planned.fail) await route.abort(); else await route.continue()
  })
  const cdp = await page.context().newCDPSession(page)
  const evidence: Array<Record<string, unknown>> = []
  const button = page.locator('.app-header .refresh')
  async function inspect(state: string, described: boolean) {
    if (described) await expect(button).toHaveAttribute('aria-describedby', 'refresh-available')
    else await expect(button).not.toHaveAttribute('aria-describedby')
    await expect(page.locator('#refresh-available')).toHaveCount(described ? 1 : 0)
    await expect(button).toHaveAccessibleDescription(described ? guidance : '')
    if (described) await expect(page.locator('#refresh-available')).toHaveAttribute('hidden', '')
    const { nodes } = await cdp.send('Accessibility.getFullAXTree')
    const exposed = nodes.filter(node => !node.ignored)
    const matches = exposed.filter(node => node.name?.value === guidance || node.description?.value === guidance)
    expect(matches, `${state}: no standalone or duplicate guidance in exposed AX nodes`).toHaveLength(described ? 1 : 0)
    if (described) {
      expect(matches[0].role?.value).toBe('button')
      expect(matches[0].name?.value).toBe(await button.getAttribute('aria-label'))
      expect(matches[0].description?.value).toBe(guidance)
    }
    const liveMessages = await page.locator('[role=status],[role=alert],[aria-live]').allTextContents()
    expect(liveMessages.some(message => message.includes(guidance)), `${state}: description is not an extra live announcement`).toBe(false)
    evidence.push({ state, described, buttonName: await button.getAttribute('aria-label'), reference: await button.getAttribute('aria-describedby'),
      guidanceNodes: matches.map(node => ({ role: node.role?.value, name: node.name?.value, description: node.description?.value })),
      liveMessages, calls: { ...calls } })
  }
  try {
    await page.goto('/')
    await expect(button).toBeDisabled()
    await inspect('initial-both-pending', false)

    latest.release()
    await expect(page.getByTestId('solar-power')).toHaveText(`${persisted.solarPowerW.toLocaleString('en-US')} W`)
    await inspect('history-pending-latest-available', true)
    latest = hold()
    await button.click()
    await expect.poll(() => calls.latest).toBe(2)
    expect(calls.history).toBe(1)
    await expect(button).toBeDisabled()
    await inspect('both-pending-after-latest-refresh', false)

    history.release()
    await expect(page.locator('.power-history')).toHaveAttribute('data-history-state', 'ready')
    await inspect('latest-pending-history-available', true)
    history = hold()
    await button.click()
    await expect.poll(() => calls.history).toBe(2)
    expect(calls.latest).toBe(2)
    await expect(button).toBeDisabled()
    await inspect('both-pending-after-history-refresh', false)
    latest.release(); history.release()
    await expect(button).toHaveAccessibleName('Refresh readings')
    await inspect('overview-settled-success', false)

    for (const section of ['Installation', 'History', 'Overview']) {
      await page.getByRole('link', { name: section, exact: true }).click()
      await expect(page.getByRole('link', { name: section, exact: true })).toHaveAttribute('aria-current')
      await inspect(`${section.toLowerCase()}-idle`, false)
    }
    expect(calls).toEqual({ latest: 2, history: 2 })

    latest = hold(true); history = hold()
    await button.click()
    await expect(button).toBeDisabled()
    await inspect('both-refreshing', false)
    latest.release()
    await expect(button).toHaveAccessibleName('Retry')
    await expect(page.locator('.hero [role=alert]')).toContainText('Previous reading')
    await inspect('latest-error-history-pending', true)
    latest = hold()
    await button.click()
    await expect.poll(() => calls.latest).toBe(4)
    expect(calls.history).toBe(3)
    await expect(button).toBeDisabled()
    await inspect('both-retry-pending', false)
    latest.release(); history.release()
    await expect(button).toHaveAccessibleName('Refresh readings')
    await inspect('overview-recovered-success', false)

    await page.getByRole('link', { name: 'History', exact: true }).click()
    history = hold(true)
    await button.click()
    await expect(button).toBeDisabled()
    await inspect('history-only-refreshing', false)
    history.release()
    await expect(button).toHaveAccessibleName('Retry')
    await expect(page.locator('.detail-notice[role=alert]')).toContainText('Previous history is still available')
    await inspect('history-settled-error', false)
    history = hold()
    await page.getByRole('button', { name: 'History Retry', exact: true }).click()
    await expect(button).toBeDisabled()
    await inspect('history-only-retrying', false)
    expect(calls.latest).toBe(4)
    history.release()
    await expect(button).toHaveAccessibleName('Refresh readings')
    await inspect('history-recovered-success', false)
    await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', persisted.measuredAt)
    expect(calls).toEqual({ latest: 4, history: 5 })
  } finally {
    latest.release(); history.release()
    await cdp.detach()
    const destination = testInfo.outputPath('refresh-guidance-ax.json')
    await writeFile(destination, JSON.stringify({ method: 'Chromium CDP exposed AX nodes and computed button descriptions; not spoken screen-reader output',
      browser: browser.version(), source: 'Real PostgreSQL seed -> API; held GETs continue to the real API; errors use test-only route.abort',
      persisted, states: evidence }, null, 2))
    await testInfo.attach('refresh-guidance-ax.json', { path: destination, contentType: 'application/json' })
  }
})
