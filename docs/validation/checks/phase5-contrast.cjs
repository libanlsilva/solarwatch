// Sample computed text foreground against rendered, composited viewport backgrounds.
// Diagnostic evidence only: excludes disabled/hidden text; not a WCAG certification.
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(repo, 'frontend/node_modules/@playwright/test'));
const base = process.env.SOLARWATCH_AUDIT_URL || 'http://127.0.0.1:4191';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use a loopback audit service.');
const output = path.join(repo, 'artifacts/phase5-audit');
const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126,.7152,.0722][i], 0);
const ratio = (a,b) => (Math.max(luminance(a),luminance(b)) + .05) / (Math.min(luminance(a),luminance(b)) + .05);
const samples = [];
(async () => {
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1186 }, timezoneId: 'America/Havana', reducedMotion: 'reduce' });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    for (const width of [1440,390]) for (const section of ['overview','history']) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1186 });
      await page.goto(`${base}/#${section}`);
      await page.reload();
      if (section === 'history') await page.locator('.selection-marker').first().waitFor(); else await page.getByTestId('solar-power').waitFor();
      for (const state of ['persisted','retained-error']) {
        if (state === 'retained-error') {
          await page.route('**/api/readings/**', route => route.abort());
          await page.locator('.refresh').click();
          await page.locator('[role=alert]').first().waitFor();
          await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'));
        }
        await page.evaluate(() => scrollTo(0,0));
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let offset = 0; offset < height; offset += width === 390 ? 550 : 900) {
          await page.evaluate(offset => scrollTo(0,offset), offset);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const text = await page.evaluate(() => {
            const result = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const node = walker.currentNode, element = node.parentElement;
              if (!node.textContent.trim() || element.closest('.sr-only,.skip-link,script,style,button:disabled,input:disabled')) continue;
              const style = getComputedStyle(element);
              let opacity = 1;
              for (let parent = element; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
              if (opacity === 0 || style.visibility !== 'visible') continue;
              const range = document.createRange(); range.selectNodeContents(node);
              for (const box of range.getClientRects()) {
                if (box.width < 2 || box.height < 2 || box.x < 0 || box.right > innerWidth || box.y < 0 || box.bottom > innerHeight) continue;
                const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                if (top !== element && !element.contains(top) && !top?.contains(element)) continue;
                result.push({ text: node.textContent.trim().slice(0,100), tag: element.tagName, class: element.getAttribute('class'),
                  foreground: element instanceof SVGElement ? style.fill : style.color, opacity, size: parseFloat(style.fontSize), weight: Number(style.fontWeight),
                  box: { x: box.x, y: box.y, width: box.width, height: box.height } });
              }
            }
            return result;
          });
          const mask = await page.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important}svg text,svg tspan{fill:transparent!important}' });
          const png = await page.screenshot();
          await mask.evaluate(element => element.remove());
          const backgrounds = await page.evaluate(async ({ encoded, text }) => {
            const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d'); context.drawImage(image,0,0);
            return text.map(item => [.2,.5,.8].flatMap(fx => [.25,.5,.75].map(fy => Array.from(context.getImageData(Math.floor(item.box.x + item.box.width * fx), Math.floor(item.box.y + item.box.height * fy),1,1).data).slice(0,3))));
          }, { encoded: png.toString('base64'), text });
          text.forEach((item,i) => {
            const foreground = item.foreground.match(/[\d.]+/g)?.map(Number);
            if (!foreground || foreground.length < 3) return;
            const alpha = (foreground[3] ?? 1) * item.opacity;
            const minimum = Math.min(...backgrounds[i].map(background => ratio(foreground.slice(0,3).map((value,index) => value * alpha + background[index] * (1-alpha)), background)));
            samples.push({ width, section, state, scrollY: offset, text: item.text, tag: item.tag, class: item.class, foreground: item.foreground,
              size: item.size, weight: item.weight, minimum: Number(minimum.toFixed(2)), target: item.size >= 24 || item.size >= 18.667 && item.weight >= 700 ? 3 : 4.5 });
          });
        }
        await page.unroute('**/api/readings/**');
      }
    }
  } finally { await browser.close(); }
  const findings = samples.filter(item => item.minimum < item.target);
  const result = { method: 'Nine rendered-background samples per visible text run after temporarily hiding text, DPR 1, external-font fallback; computed color/fill and ancestor opacity. Sampled coverage, not exhaustive certification.',
    samples: samples.length, minimumNormal: Math.min(...samples.filter(item => item.target === 4.5).map(item => item.minimum)),
    minimumLarge: Math.min(...samples.filter(item => item.target === 3).map(item => item.minimum)), findings, observations: samples };
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'contrast.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({ samples: result.samples, minimumNormal: result.minimumNormal, minimumLarge: result.minimumLarge, findings },null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
