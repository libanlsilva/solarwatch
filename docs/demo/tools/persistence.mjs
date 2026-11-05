import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { configuration, readJson, writeJson, databaseRows, digest, canonical, micros, get } from './dataset.mjs'

const [clone, state, mode] = process.argv.slice(2)
assert(['before', 'after'].includes(mode), 'clone state before|after')
const cfg = configuration(clone, state)
const rows = databaseRows(cfg)
const latest = await get(cfg, '/api/readings/latest')
const history = await get(cfg, '/api/readings/history')
const subset = rows.filter(row => micros(row.measuredAt) >= micros(history.from) && micros(row.measuredAt) <= micros(history.to))
assert.equal(canonical(history.readings), canonical(subset))
const record = { checkedAt: new Date().toISOString(), persistedCount: rows.length, postgresSha256: digest(rows), latest,
  history: { asOf: history.asOf, from: history.from, to: history.to, count: history.readings.length, matchesSqlSubset: true } }
assert.equal(record.postgresSha256, readJson(path.join(cfg.state, 'dataset.json')).postgresSha256)
if (mode === 'after') {
  const before = readJson(path.join(cfg.state, 'persistence-before.json'))
  assert.equal(record.postgresSha256, before.postgresSha256)
  assert.equal(record.persistedCount, 1441)
  assert.equal(canonical([record.latest.reading]), canonical([before.latest.reading]))
  assert(micros(record.latest.asOf) > micros(before.latest.asOf))
  const { chromium, expect } = createRequire(path.join(cfg.clone, 'frontend/package.json'))('@playwright/test')
  const browser = await chromium.launch({ channel: 'chromium' })
  try {
    const page = await browser.newPage({ locale: 'en-US', timezoneId: 'America/Havana' })
    await page.goto(cfg.web)
    await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
    await expect(page.getByTestId('consumption-power')).toHaveText(`${latest.reading.consumptionPowerW.toLocaleString('en-US')} W`)
    await page.reload()
    await expect(page.getByTestId('solar-power')).toHaveText(`${latest.reading.solarPowerW.toLocaleString('en-US')} W`)
    await page.getByRole('link', { name: 'History', exact: true }).click()
    await expect(page.getByTestId('history-selected-time')).toHaveAttribute('datetime', latest.reading.measuredAt)
    record.browserReload = { passed: true, browser: browser.version(), measuredAt: latest.reading.measuredAt }
  } finally { await browser.close() }
}
writeJson(path.join(cfg.state, `persistence-${mode}.json`), record)
console.log(`${mode}: ${rows.length} persisted rows, SQL/API consistency${mode === 'after' ? ', identical digest and real browser reload verified' : ''}.`)
