// Evidence collector, not an acceptance test or accessibility certification.
// Read-only application/API interaction; prepare disposable persisted data separately.
// Uses the existing Playwright installation. No added dependency or product code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(repo, 'frontend/node_modules/@playwright/test'));
const base = process.env.SOLARWATCH_AUDIT_URL || 'http://127.0.0.1:4191';
const api = process.env.SOLARWATCH_AUDIT_API || 'http://127.0.0.1:5191';
for (const value of [base, api]) if (!['127.0.0.1', 'localhost'].includes(new URL(value).hostname)) throw new Error('Use loopback audit services.');
const output = path.join(repo, 'artifacts/phase5-audit');
fs.mkdirSync(output, { recursive: true });
const report = { kind: 'Agent-executed automated diagnostics; observations require review, not extra passing tests',
  productCommit: execFileSync('git', ['-c', `safe.directory=${repo.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(), timezone: 'America/Havana', base, api,
  layouts: [], focus: [], footprints: [], requests: [], errors: [], captures: [] };
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function geometry(page) {
  return page.evaluate(() => {
    const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
    const describe = element => ({ tag: element.tagName, class: element.getAttribute('class'), text: element.textContent.trim().slice(0, 70) });
    const header = document.querySelector('.app-header').getBoundingClientRect();
    const context = document.querySelector('.history-context');
    return { width: innerWidth, height: innerHeight, pageOverflow: document.documentElement.scrollWidth > innerWidth,
      overflow: [...document.querySelectorAll('.card,.detail-chart,.app-header,.measurement-pair,.metric-pair,main')]
        .filter(element => visible(element) && element.scrollWidth > element.clientWidth + 1).map(describe),
      smallControls: [...document.querySelectorAll('nav a,button,input[type=range]')].filter(element => visible(element) && !element.disabled)
        .filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(describe),
      header: { height: header.height, bottom: header.bottom, position: getComputedStyle(document.querySelector('.app-header')).position },
      context: context ? { height: context.getBoundingClientRect().height, top: context.getBoundingClientRect().top, position: getComputedStyle(context).position } : null,
      live: [...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map(element => ({ role: element.getAttribute('role'), live: element.getAttribute('aria-live'), text: element.textContent.trim().slice(0, 230), busyAncestor: !!element.closest('[aria-busy=true]') })),
      activeNavigation: document.querySelector('nav [aria-current]')?.textContent,
      numericWrapping: [...document.querySelectorAll('.context-values dd')].flatMap(element => [...element.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        .map(node => { const range = document.createRange(); range.selectNodeContents(node); return { value: node.textContent.trim(), lines: new Set([...range.getClientRects()].map(box => Math.round(box.y))).size }; })),
      headerGuidance: { text: document.getElementById('refresh-available')?.textContent, class: document.getElementById('refresh-available')?.className,
        buttonDescription: document.querySelector('.refresh')?.getAttribute('aria-describedby'), buttonName: document.querySelector('.refresh')?.getAttribute('aria-label'),
        pendingRegions: document.querySelectorAll('[aria-busy=true]').length },
      fonts: [...document.fonts].map(font => ({ family: font.family, status: font.status })) };
  });
}
async function capture(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
  report.captures.push({ name, fullPage, viewport: page.viewportSize(), url: page.url() });
}
async function inspectFocus(page, scenario, count = 12) {
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  for (let index = 0; index < count; index++) {
    await page.keyboard.press('Tab');
    await settle(page);
    const item = await page.evaluate(() => {
      const element = document.activeElement;
      const box = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, box.x + box.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, box.y + box.height / 2));
      const top = document.elementFromPoint(x, y);
      const style = getComputedStyle(element);
      return { tag: element.tagName, label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 70),
        testId: element.getAttribute('data-testid'), box: { x: box.x, y: box.y, width: box.width, height: box.height },
        outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
        centerExposed: element === top || element.contains(top), occluder: top?.closest('header,.history-context')?.className || top?.tagName,
        inViewport: box.top >= -1 && box.bottom <= innerHeight + 1, scrollY };
    });
    report.focus.push({ scenario, index, ...item });
    if (item.tag !== 'BODY' && (!item.centerExposed || !item.inViewport)) await capture(page, `focus-${scenario}-${index}`);
  }
}
async function enlargeText(page, multiplier) {
  await page.evaluate(multiplier => {
    const entries = [...document.querySelectorAll('body *')]
      .filter(element => element instanceof HTMLElement && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
      .map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
    for (const [element, size] of entries) element.style.fontSize = `${size * multiplier}px`;
  }, multiplier);
  await settle(page);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1186 }, timezoneId: report.timezone, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/readings')) report.requests.push({ path: new URL(request.url()).pathname, method: request.method() }); });
    report.externalFonts = 'Intentionally blocked for fallback audit, not an API failure.';
    const response = await fetch(`${api}/api/readings/history`);
    if (!response.ok) throw new Error(`Audit API failed: ${response.status}`);
    const history = await response.json();
    if (!history.readings.length) throw new Error('Persist audit readings before running this collector.');
    report.persistedHistory = { asOf: history.asOf, from: history.from, to: history.to, count: history.readings.length,
      sha256: crypto.createHash('sha256').update(JSON.stringify(history)).digest('hex'), first: history.readings[0], last: history.readings.at(-1) };
    const sizes = [[360,640],[390,667],[430,844],[768,1024],[1024,900],[1440,1186],[374,844],[375,844],[899,844],[900,844],[901,844],[1249,900],[1250,900],[1251,900],[667,375],[844,390]];
    await page.goto(base);
    await page.getByTestId('solar-power').waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const section of ['Overview', 'Installation', 'History']) {
        await page.getByRole('link', { name: section, exact: true }).click();
        if (section === 'History') await page.locator('.selection-marker').first().waitFor();
        await settle(page);
        report.layouts.push({ section, ...(await geometry(page)) });
      }
    }
    report.requestsAfterNavigation = [...report.requests];
    for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }, { width: 1440, height: 1186 }]) {
      await page.setViewportSize(size);
      if (page.url() === `${base}/#history`) await page.reload(); else await page.goto(`${base}/#history`);
      await page.locator('.selection-marker').first().waitFor();
      await inspectFocus(page, `${size.width}x${size.height}`);
    }
    const footprintCases = [
      { state: 'selected', width: 390, height: 844 }, { state: 'missing', width: 390, height: 844 },
      { state: 'overlap', width: 390, height: 844 }, { state: 'enlarged', width: 390, height: 844 },
      { state: 'enlarged-short-360', width: 360, height: 640 }, { state: 'enlarged-short-390', width: 390, height: 667 },
      { state: 'enlarged-landscape', width: 844, height: 390 },
    ];
    for (const { state, width, height } of footprintCases) {
      await page.setViewportSize({ width, height });
      if (page.url() === `${base}/#history`) await page.reload(); else await page.goto(`${base}/#history`);
      await page.locator('.selection-marker').first().waitFor();
      if (state === 'missing') await page.getByRole('button', { name: 'Next minute', exact: true }).click();
      if (state === 'overlap') {
        const rows = history.readings;
        const at = rows.find((row, i) => i && Date.parse(row.measuredAt) === Date.parse(rows[i - 1].measuredAt))?.measuredAt;
        if (!at) throw new Error('Overlap evidence requires persisted same-millisecond rows.');
        const point = page.locator(`.history-point[data-series=solar][data-measured-at="${at}"]`);
        await point.scrollIntoViewIfNeeded();
        const box = await point.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      if (state.startsWith('enlarged')) await enlargeText(page, 2);
      await settle(page);
      report.footprints.push({ state, ...(await geometry(page)) });
      await inspectFocus(page, state);
      await page.getByRole('heading', { name: 'History', exact: true }).click();
      await page.evaluate(() => scrollTo(0,0));
      await capture(page, `history-${state}-${width}x${height}`, true);
    }
    await context.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'observations.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ layouts: report.layouts.length, focusedControls: report.focus.length, footprintStates: report.footprints.length,
    overflows: report.layouts.filter(item => item.pageOverflow || item.overflow.length).map(item => ({ section: item.section, size: [item.width,item.height], elements: item.overflow })),
    smallControls: report.layouts.filter(item => item.smallControls.length).length,
    obscuredFocus: report.focus.filter(item => item.tag !== 'BODY' && !item.centerExposed).map(item => ({ scenario: item.scenario, label: item.label, occluder: item.occluder })), errors: report.errors }, null, 2));
})().catch(error => { fs.writeFileSync(path.join(output, 'incomplete.json'), JSON.stringify({ error: error.message, report }, null, 2)); console.error(error.message); process.exitCode = 1; });
