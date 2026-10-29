// Isolated design-artifact verification; no app code, API requests or export rewrites.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const repo = path.resolve(__dirname, '../../..');
const folder = path.join(repo, 'docs/design/prototypes');
const { chromium } = require(path.join(repo, 'frontend/node_modules/@playwright/test'));
const check = (value, message) => { if (!value) throw new Error(message); };
const url = name => pathToFileURL(path.join(folder, name)).href;
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { kind: 'Design-artifact checks, not application tests or full accessibility certification', cases: [], errors: [], dataRequests: [], missingResources: [] };
const references = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8')).files;
function verifyHashes() {
  check(references.every(r => digest(path.join(folder, r.path)) === r.sha256), 'An approved export differs from its manifest.');
  return references.length;
}
function contrast(a, b) {
  const luminance = hex => {
    const channels = hex.match(/\w\w/g).map(v => parseInt(v, 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels.reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Number(((values[0] + .05) / (values[1] + .05)).toFixed(2));
}
function observe(page) {
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (['xhr', 'fetch'].includes(r.resourceType())) report.dataRequests.push(r.url()); });
  page.on('requestfailed', r => { if (r.url().startsWith('file:')) report.missingResources.push(r.url()); });
}
async function geometry(page, touch) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
    cardOverflow: [...document.querySelectorAll('.card')].some(e => e.scrollWidth > e.clientWidth + 1),
    photoLoaded: document.querySelector('.photo,.hero-photo')?.naturalWidth === 1672,
    targets: [...document.querySelectorAll('.refresh,nav a,.minute-controls button,#minute-selector')].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))
  }));
  check(!result.overflow && !result.cardOverflow && result.photoLoaded, 'Layout overflow or missing authorized photo.');
  if (touch) check(result.targets.every(t => t.width >= 44 && t.height >= 44), 'Mobile target below 44px.');
  return result;
}
(async () => {
  report.verifiedExports = verifyHashes();
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1200 }, reducedMotion: 'reduce' });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const pages = { desktop: await desktop.newPage(), mobile: await mobile.newPage() };
    Object.values(pages).forEach(observe);
    const main = { desktop: ['desktop-v2', 'history-desktop-v1'], mobile: ['mobile-v1', 'history-mobile-v1'] };
    report.main = [];
    for (const [platform, groups] of Object.entries(main)) for (const group of groups) {
      const page = pages[platform];
      await page.goto(url(`${group}/index.html`));
      await page.evaluate(() => document.fonts.ready);
      for (const width of platform === 'mobile' ? [360, 390, 430] : [1440]) {
        await page.setViewportSize({ width, height: platform === 'mobile' ? 844 : 1200 });
        report.main.push({ group, ...await geometry(page, platform === 'mobile') });
      }
      if (group.startsWith('history')) {
        const selected = await page.evaluate(() => {
          historyDesignReview.select(595);
          return { state: historyDesignReview.getState(), values: [...document.querySelectorAll('.selected-values dd>span')].map(e => e.textContent) };
        });
        check(selected.state.selected === 595 && selected.values.every(v => v === '—'), 'Missing minute became a recorded value.');
        await page.evaluate(() => historyDesignReview.select(850));
        check(await page.locator('.selected-values dd>span').first().textContent() === '0', 'Real solar zero was hidden.');
      }
    }
    const states = { overview: ['loading', 'empty', 'error', 'stale', 'refreshing', 'retained'], history: ['loading', 'empty', 'error', 'refreshing', 'retained', 'partial'] };
    for (const [view, values] of Object.entries(states)) for (const state of values) for (const [platform, page] of Object.entries(pages)) {
      await page.setViewportSize({ width: platform === 'mobile' ? 390 : 1440, height: platform === 'mobile' ? 844 : 1200 });
      const surface = `${view}-${platform}`;
      await page.goto(url(`interface-states-v1/${surface}.html`) + `?state=${state}`);
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const history = document.documentElement.dataset.stateSurface.startsWith('history');
        const mobile = document.documentElement.dataset.stateSurface.endsWith('mobile');
        const root = document.querySelector(history ? (mobile ? '.history-content' : '.workspace') : (mobile ? '.content' : '.stage'));
        return {
          snapshot: solarWatchStatePreview.getState(), busy: root.getAttribute('aria-busy'), disabled: document.querySelector('.refresh').disabled,
          values: history ? [...document.querySelectorAll('.selected-values dd>span')].map(e => e.textContent) : [...document.querySelectorAll(mobile ? '.metric-value' : '.metric .value')].map(e => e.textContent),
          paths: [...document.querySelectorAll('#power-chart path[stroke],#battery-chart path[stroke]')].filter(e => !e.closest('defs')).length,
          boundary: solarWatchStatePreview.isStaleAt('2026-10-28T18:32:00Z', '2026-10-28T18:37:00Z'),
          afterBoundary: solarWatchStatePreview.isStaleAt('2026-10-28T18:32:00Z', '2026-10-28T18:37:00.001Z'),
          noticeBottom: document.querySelector('.state-notice')?.getBoundingClientRect().bottom,
          metricsTop: document.querySelector('.metric-pair,.power-pair')?.getBoundingClientRect().top,
          spinnerAnimation: document.querySelector('.state-spinner') ? getComputedStyle(document.querySelector('.state-spinner')).animationName : null
        };
      });
      check(!result.boundary && result.afterBoundary, 'Freshness is not strictly >300 seconds.');
      check(!result.noticeBottom || result.noticeBottom < result.metricsTop, 'Notice overlaps metric cards.');
      check(result.spinnerAnimation === null || result.spinnerAnimation === 'none', 'Reduced-motion spinner still animates.');
      if (['loading', 'empty', 'error'].includes(state)) {
        check(result.values.every(v => !/[0-9]/.test(v)) && result.paths === 0 && result.snapshot.measuredAt === null, 'Initial unavailable data is fabricated.');
        if (state !== 'empty') check(result.snapshot.asOf === null, 'Failed/pending query invented a server reference.');
      }
      if (['loading', 'refreshing'].includes(state)) {
        check(result.busy === 'true' && result.disabled, 'Pending query action is not disabled/busy.');
        check(await page.evaluate(() => !solarWatchStatePreview.beginRequest() && !solarWatchStatePreview.beginRequest()), 'Duplicate preview starts allowed.');
      }
      if (state === 'stale') check(result.snapshot.asOf === '2026-10-28T18:39:30Z' && result.values[0].includes('1,200'), 'Stale snapshot lost data.');
      if (state === 'partial') {
        const runs = await page.evaluate(() => historyDesignReview.getState().segments);
        check(runs.length === 2 && runs[0].start === 90 && runs[0].end === 579 && runs[1].start === 610 && runs[1].end === 1440, 'Gap was bridged.');
      }
      const layouts = [];
      for (const width of platform === 'mobile' ? [360, 390, 430] : [1440]) {
        await page.setViewportSize({ width, height: platform === 'mobile' ? 844 : 1200 });
        layouts.push(await geometry(page, platform === 'mobile'));
      }
      report.cases.push({ surface, state, ...result, layouts });
    }
    const page = pages.mobile;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('interface-states-v1/overview-mobile.html') + '?state=error');
    await page.getByRole('button', { name: 'Retry measurements', exact: true }).tap();
    check(await page.evaluate(() => solarWatchStatePreview.getState().state === 'loading' && !solarWatchStatePreview.beginRequest()), 'Retry is not single-flight/manual.');
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => solarWatchStatePreview.finishRequest(false))]);
    check(await page.evaluate(() => solarWatchStatePreview.getState().state === 'error'), 'Initial failure incorrectly retained nonexistent data.');
    await page.goto(url('interface-states-v1/overview-mobile.html') + '?state=stale');
    await page.getByRole('button', { name: 'Refresh measurements', exact: true }).tap();
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => solarWatchStatePreview.finishRequest(false))]);
    report.retainedStale = await page.evaluate(() => solarWatchStatePreview.getState());
    check(report.retainedStale.state === 'retained' && report.retainedStale.asOf === '2026-10-28T18:39:30Z', 'Failed refresh lost stale reference.');
    await page.goto(url('interface-states-v1/history-mobile.html') + '?state=partial');
    await page.evaluate(() => historyDesignReview.select(595));
    await page.getByRole('button', { name: 'Refresh history', exact: true }).tap();
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => solarWatchStatePreview.finishRequest(false))]);
    check(await page.evaluate(() => historyDesignReview.getState().selected === 595 && [...document.querySelectorAll('.selected-values dd>span')].every(e => e.textContent === '—')), 'Failed refresh lost selected gap.');
    check(await page.evaluate(() => { const before = JSON.stringify(solarWatchStatePreview.getState()); Date.now = () => 0; return before === JSON.stringify(solarWatchStatePreview.getState()); }), 'Browser clock changed freshness.');
    // Real keyboard/touch selection, independent of hover.
    await page.goto(url('history-mobile-v1/index.html'));
    await page.locator('#minute-selector').focus();
    await page.keyboard.press('ArrowRight');
    check(await page.evaluate(() => historyDesignReview.getState().selected === 1061), 'Keyboard minute selection failed.');
    await page.locator('#power-chart').tap({ position: { x: 100, y: 60 } });
    check(await page.evaluate(() => historyDesignReview.getState().selected !== 1061), 'Touch selection failed.');
    report.shortPhones = [];
    for (const [width, height] of [[360, 640], [390, 667], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { const r = document.querySelector('#battery-chart').getBoundingClientRect(); scrollTo(0, scrollY + r.top - 400); });
      report.shortPhones.push(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, header: document.querySelector('header').getBoundingClientRect().height, stickyBottom: document.querySelector('.minute-card').getBoundingClientRect().bottom })));
    }
    await pages.desktop.goto(url('interface-states-v1/index.html'));
    report.gallery = [];
    for (const state of ['loading', 'empty', 'error', 'stale', 'refreshing', 'retained', 'partial']) {
      await pages.desktop.locator(`[data-state="${state}"]`).click();
      const views = state === 'stale' ? ['overview'] : state === 'partial' ? ['history'] : ['overview', 'history'];
      for (const view of views) {
        await pages.desktop.locator(`[data-view="${view}"]`).click();
        await pages.desktop.waitForFunction(() => [...document.querySelectorAll('.pair img')].every(i => i.complete && i.naturalWidth > 0));
        const links = await pages.desktop.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.href));
        links.forEach(link => check(fs.existsSync(require('node:url').fileURLToPath(link.split('?')[0])), 'Gallery has a missing local target.'));
        report.gallery.push({ state, view });
      }
    }
    report.contrast = Object.fromEntries([
      ['primary/shell', 'f4f7f3', '06110f'], ['secondary/shell', 'a9bbb0', '06110f'],
      ['action/yellow', '111b09', 'f1ff16'], ['solar/shell', 'f1ff16', '06110f'],
      ['consumption/shell', '36cbb0', '06110f'], ['battery/shell', 'b7f36b', '06110f']
    ].map(([name, a, b]) => [name, contrast(a, b)]));
    check(Object.values(report.contrast).every(v => v >= 4.5), 'Documented solid-color contrast pair failed.');
    verifyHashes();
    check(!report.errors.length && !report.dataRequests.length && !report.missingResources.length, 'Scripts, isolation or resources failed.');
  } finally { await browser.close(); }
  const destination = path.join(repo, 'artifacts/design-review');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ exports: report.verifiedExports, mainLayouts: report.main.length, states: report.cases.length, galleryPairs: report.gallery.length, contrast: report.contrast, errors: report.errors, dataRequests: report.dataRequests, missingResources: report.missingResources }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
