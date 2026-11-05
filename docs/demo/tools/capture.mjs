import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { configuration, readJson, writeJson, micros, canonical, digest, empty, get, verify } from './dataset.mjs'

const [clone, state, mode = 'capture', referenceFile] = process.argv.slice(2)
assert(clone && state && ['capture', 'repeat'].includes(mode), 'clone state [capture|repeat reference-dataset.json]')
const cfg = configuration(clone, state)
const { chromium, expect } = createRequire(path.join(cfg.clone, 'frontend/package.json'))('@playwright/test')
const run = promisify(execFile)
const record = { source: 'Unmodified clean-clone production React -> Vite /api proxy -> real .NET API -> isolated PostgreSQL',
  sourceCommit: cfg.setup.commit, apiPort: cfg.setup.apiPort, webPort: cfg.setup.webPort,
  locale: 'en-US', timezone: 'America/Havana', reducedMotion: 'reduce', apiMocks: false, clockManipulation: false,
  physicalDevice: false, interactions: [], captures: [], javascriptErrors: [], fontFailures: [] }
const browser = await chromium.launch({ channel: 'chromium' })
record.browser = browser.version()
const pages = []
let stored

async function fonts(page) {
  const ready = await page.evaluate(async () => Promise.race([document.fonts.ready.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 20_000))]))
  return page.evaluate(ready => ({ ready, bodyFamily: getComputedStyle(document.body).fontFamily,
    loadedFaces: [...document.fonts].filter(face => face.status === 'loaded').map(face => ({ family: face.family, weight: face.weight, status: face.status })) }), ready)
}
async function open(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1186 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'en-US', timezoneId: record.timezone, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const item = { page, context, mobile, calls: { latest: 0, history: 0 } }
  page.on('pageerror', error => record.javascriptErrors.push(error.message))
  page.on('request', request => {
    if (request.url().endsWith('/api/readings/latest')) item.calls.latest++
    if (request.url().endsWith('/api/readings/history')) item.calls.history++
  })
  page.on('requestfailed', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) record.fontFailures.push({ host: new URL(request.url()).hostname, error: request.failure()?.errorText }) })
  // No request routing/fulfillment or clock overrides, including font requests.
  await page.goto(cfg.web, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
  item.fonts = await fonts(page) // Warm both real font/image contexts BEFORE choosing T.
  await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())))
  pages.push(item)
  return item
}
async function refresh(item, historyOnly = false) {
  const response = item.page.waitForResponse(r => r.url().endsWith('/api/readings/history'))
  await item.page.getByRole('button', { name: /Refresh/ }).click()
  const snapshot = await (await response).json()
  const expected = stored.filter(row => micros(row.measuredAt) >= micros(snapshot.from) && micros(row.measuredAt) <= micros(snapshot.to))
  assert.equal(canonical(snapshot.readings), canonical(expected))
  await expect(item.page.locator('.solar-series .recharts-area-curve')).toBeVisible()
  if (!historyOnly) {
    const latest = await get(cfg, '/api/readings/latest')
    await expect(item.page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
    await expect(item.page.getByTestId('consumption-power')).toHaveText(`${latest.reading.consumptionPowerW.toLocaleString('en-US')} W`)
    const charge = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(latest.reading.batteryStateOfChargePercent)
    await expect(item.page.getByTestId('battery-charge')).toHaveText(`${charge}%`)
    const displayedAsOf = await item.page.getByTestId('checked-at').getAttribute('datetime')
    const fresh = micros(displayedAsOf) - micros(latest.reading.measuredAt) <= 300_000_000n
    await expect(item.page.getByText(fresh ? 'Fresh at last check' : 'Stale reading', { exact: true })).toBeVisible()
  }
  return snapshot
}
async function geometry(item, snapshot) {
  const errors = {}
  for (const [series, field, type] of [['solar', 'solarPowerW', 'area'], ['consumption', 'consumptionPowerW', 'line'], ['battery', 'batteryStateOfChargePercent', 'area']]) {
    const d = await item.page.locator(`.${series}-series .recharts-${type}-curve`).getAttribute('d')
    const vertices = [...d.matchAll(/[ML]([-\d.eE]+),([-\d.eE]+)/g)].map(m => ({ x: +m[1], y: +m[2] }))
    assert.equal(vertices.length, snapshot.readings.length)
    const values = snapshot.readings.map(row => row[field]); const low = Math.min(...values), high = Math.max(...values)
    const lo = vertices[values.indexOf(low)], hi = vertices[values.indexOf(high)]
    const scale = (hi.y - lo.y) / (high - low); assert(scale < 0)
    const start = micros(snapshot.readings[0].measuredAt), duration = Number(micros(snapshot.readings.at(-1).measuredAt) - start)
    const result = vertices.map((p, i) => ({ x: Math.abs(p.x - (vertices[0].x + Number(micros(snapshot.readings[i].measuredAt) - start) / duration * (vertices.at(-1).x - vertices[0].x))),
      y: Math.abs(p.y - (lo.y + (values[i] - low) * scale)) }))
    errors[series] = { vertices: vertices.length, maximumXErrorPx: Math.max(...result.map(p => p.x)), maximumYErrorPx: Math.max(...result.map(p => p.y)) }
    assert(errors[series].maximumXErrorPx < .002 && errors[series].maximumYErrorPx < .002)
  }
  return errors
}
async function selection(item, expectedMode) {
  const page = item.page
  await expect(page.getByTestId('power-plot')).toHaveAttribute('data-selection-mode', expectedMode)
  await expect(page.getByTestId('battery-plot')).toHaveAttribute('data-selection-mode', expectedMode)
  const at = await page.getByTestId('history-selected-time').getAttribute('datetime')
  const row = stored.find(row => micros(row.measuredAt) === micros(at)); assert(row)
  for (const [series, field, unit] of [['solar', 'solarPowerW', 'W'], ['consumption', 'consumptionPowerW', 'W'], ['battery', 'batteryStateOfChargePercent', '%']]) {
    await expect(page.getByTestId(`history-selected-${series}`)).toHaveText(`${row[field].toLocaleString('en-US')}${unit}`)
    await expect(page.locator(`.selection-marker[data-series="${series}"]`)).toHaveAttribute('data-measured-at', at)
    await expect(page.locator(`.selection-marker[data-series="${series}"]`)).toHaveAttribute('data-value', String(row[field]))
  }
  return { mode: expectedMode, measuredAt: at, matchesSql: true, values: row }
}
async function screenshot(item, name, fullPage) {
  if (mode !== 'capture') return
  const latest = await get(cfg, '/api/readings/latest')
  const seconds = Number(micros(latest.asOf) - micros(latest.reading.measuredAt)) / 1e6
  assert(seconds >= 0 && seconds <= 300, 'Capture data no longer fresh: retain it, do not reset/fake time; prepare another isolated demo if needed.')
  await item.page.evaluate(() => scrollTo(0, 0))
  await item.page.mouse.move(4, 4)
  const display = await item.page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    serverReferences: [...document.querySelectorAll('time[data-testid]')].map(el => ({ testId: el.dataset.testid, dateTime: el.getAttribute('datetime') })) }))
  assert.equal(display.horizontalOverflow, false)
  const file = path.join(cfg.state, `${name}.png`)
  await item.page.screenshot({ path: file, fullPage, timeout: 30_000 })
  const bytes = fs.readFileSync(file)
  record.captures.push({ file: `${name}.png`, fullPage, ...display, fonts: await fonts(item.page),
    png: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, sha256: createHash('sha256').update(bytes).digest('hex'),
    freshnessCheck: { asOf: latest.asOf, measuredAt: latest.reading.measuredAt, ageSeconds: seconds, fresh: true }, provenance: 'Actual app screenshot; no altered data/clock/HTTP responses' })
}

try {
  await empty(cfg)
  const desktop = await open(false), mobile = await open(true)
  const reference = mode === 'repeat' ? readJson(referenceFile).originalReference : (await get(cfg, '/api/readings/latest')).asOf
  const args = [path.join(cfg.clone, 'simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll'),
    '--history-24h', '--profile', 'residential-v1', '--seed', '42', '--end-at', reference, '--api-url', cfg.api]
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(ConnectionStrings__|SOLARWATCH_(TEST|E2E)_CONNECTION|POSTGRES_|PGPASSWORD)/i.test(key)))
  const cli = await run('dotnet', args, { env: childEnv, encoding: 'utf8', timeout: 90_000, maxBuffer: 1024 * 1024 })
  assert.equal(cli.stderr, '')
  fs.writeFileSync(path.join(cfg.state, 'simulator.log'), cli.stdout)
  const verified = await verify(cfg, cli.stdout, reference); stored = verified.stored
  record.dataset = verified.result
  record.simulatorCommand = ['dotnet', 'simulator/SolarWatch.Simulator/bin/Release/net10.0/SolarWatch.Simulator.dll', ...args.slice(1)]
  if (mode === 'repeat') { assert.equal(verified.result.postgresSha256, readJson(referenceFile).postgresSha256); record.exactDatasetReplay = true }
  for (const item of pages) {
    await expect(item.page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible()
    assert.deepEqual(item.calls, { latest: 1, history: 1 }, 'No browser polling before manual Refresh')
    const snapshot = await refresh(item)
    record.interactions.push({ device: item.mobile ? 'mobile emulation' : 'desktop', action: 'empty -> CLI persisted -> manual Refresh', calls: { ...item.calls },
      snapshot: { asOf: snapshot.asOf, from: snapshot.from, to: snapshot.to, readings: snapshot.readings.length }, geometry: await geometry(item, snapshot) })
  }
  await screenshot(desktop, 'overview-desktop', true)
  await screenshot(mobile, 'overview-mobile', false)
  await screenshot(mobile, 'overview-mobile-full', true)
  for (const item of pages) {
    const page = item.page
    await page.getByRole('link', { name: 'Installation', exact: true }).click()
    await expect(page).toHaveURL(/#installation$/)
    await expect(page.getByRole('heading', { name: 'Your installation', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Overview', exact: true }).click()
    await page.getByRole('link', { name: 'History', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible()
    const before = { ...item.calls }
    await page.getByTestId('power-plot').focus(); await page.keyboard.press('End'); await page.keyboard.press('ArrowLeft')
    const exact = await selection(item, 'observation')
    await page.getByRole('button', { name: 'Previous minute', exact: true }).click()
    const minute = await selection(item, 'minute')
    if (item.mobile) {
      const slider = page.getByRole('slider', { name: 'Inspected UTC minute' })
      await slider.scrollIntoViewIfNeeded()
      const box = await slider.boundingBox(); assert(box)
      await page.touchscreen.tap(box.x + box.width * .65, box.y + box.height / 2)
      const sliderSelection = await selection(item, 'minute')
      const target = page.locator('.power-plot .history-inspection-target')
      await target.evaluate(el => el.scrollIntoView({ block: 'end' }))
      const plot = await target.boundingBox(); assert(plot)
      await page.touchscreen.tap(plot.x + plot.width * .6, plot.y + plot.height * .4)
      const tappedSelection = await selection(item, 'minute')
      assert.notEqual(tappedSelection.measuredAt, sliderSelection.measuredAt, 'Touch activation really changed the inspected minute')
    }
    // Pointer activation of a dense plot is a minute, never falsely claimed exact.
    const target = page.locator('.power-plot .history-inspection-target')
    await target.evaluate(el => el.scrollIntoView({ block: 'end' }))
    const box = await target.boundingBox(); assert(box)
    await page.mouse.click(box.x + box.width * .55, box.y + box.height * .35)
    await selection(item, 'minute')
    await page.getByTestId('battery-plot').focus(); await page.keyboard.press('ArrowRight')
    const selected = await selection(item, 'observation')
    assert.deepEqual(item.calls, before, 'Navigation and selections do not add API requests')
    const previousAsOf = await page.getByTestId('history-asof').getAttribute('datetime')
    await refresh(item, true)
    const retained = await selection(item, 'observation')
    assert.equal(retained.measuredAt, selected.measuredAt)
    assert(micros(await page.getByTestId('history-asof').getAttribute('datetime')) > micros(previousAsOf))
    assert.equal(item.calls.latest, before.latest)
    assert.equal(item.calls.history, before.history + 1)
    await page.getByRole('heading', { name: 'History', exact: true }).click()
    record.interactions.push({ device: item.mobile ? 'mobile emulation' : 'desktop', action: 'navigation, exact keys, UTC-minute buttons, pointer/touch, synchronized markers, History Refresh retention',
      exact, minute, capturedSelection: retained, calls: { ...item.calls }, previousAsOf, refreshedAsOf: await page.getByTestId('history-asof').getAttribute('datetime') })
  }
  await screenshot(desktop, 'history-desktop', true)
  await screenshot(mobile, 'history-mobile', false)
  await screenshot(mobile, 'history-mobile-full', true)
  assert.deepEqual(record.javascriptErrors, [])
  record.result = 'pass'; record.completed = new Date().toISOString()
  writeJson(path.join(cfg.state, 'browser.json'), record)
  console.log(`${mode}: complete PostgreSQL/CLI/API digest match; manual Refresh, navigation, exact/minute/keyboard/touch and ${record.captures.length} actual captures passed.`)
} finally {
  await browser.close()
}
