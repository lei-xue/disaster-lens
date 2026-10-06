// Synthetic data, actual built UI. Detect clipped controls as well as page overflow.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL;
assert.ok(base, 'Set BASE_URL explicitly');
const routes = ['#/', '#/disasters', '#/disaster/400', '#/about', '#/preparedness', '#/alerts'];
(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const width of [320, 390, 1440]) for (const zoom of [100, 200]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.route('**/api/open/v2/DisasterDeclarationsSummaries**', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ DisasterDeclarationsSummaries: [{
          disasterNumber: 400, state: 'CA', declarationTitle: 'SYNTHETIC long title for geometry checking',
          incidentType: 'Flood', declarationDate: '2026-01-01T00:00:00.000Z',
          designatedArea: 'SYNTHETIC County', declarationType: 'DR',
        }] }),
      }));
      for (const hash of routes) {
        await page.goto(base + hash, { waitUntil: 'networkidle' });
        await page.locator('h1').waitFor({ state: 'attached' });
        if (hash === '#/') await page.getByLabel('Loaded data scope').waitFor();
        if (hash === '#/disasters') await page.locator('tbody tr').first().waitFor();
        if (hash.startsWith('#/disaster/')) await page.locator('article').waitFor();
        await page.evaluate(value => { document.documentElement.style.fontSize = value + '%'; }, zoom);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: innerWidth,
          clipping: [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX],
          outside: [...document.querySelectorAll('nav a,main button,main select,main input,main summary')].filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.width && rect.height && (rect.x < -1 || rect.right > innerWidth + 1) && !element.closest('[role="region"]');
          }).map(element => ({ text: element.textContent.trim().slice(0, 60), tag: element.tagName, x: element.getBoundingClientRect().x, right: element.getBoundingClientRect().right })),
        }));
        assert.ok(!geometry.clipping.some(value => value === 'clip' || value === 'hidden'), 'do not mask defects by clipping the root');
        assert.ok(geometry.scroll <= width + 1, JSON.stringify({ width, zoom, hash, geometry }));
        assert.deepEqual(geometry.outside, [], JSON.stringify({ width, zoom, hash, geometry }));
        if (hash === '#/') {
          await page.locator('.rsm-geography[data-state="PA"]').hover();
          const tooltip = page.getByRole('tooltip');
          await tooltip.waitFor();
          assert.match(await tooltip.innerText(), /Pennsylvania/);
          const rect = await tooltip.boundingBox();
          assert.ok(rect.x >= -1 && rect.x + rect.width <= width + 1, JSON.stringify({ width, zoom, tooltip: rect }));
          await page.mouse.move(1, 1);
          assert.equal(await tooltip.isVisible(), false);
          const advanced = page.locator('details.dl-filter-details');
          if (await advanced.count()) {
            assert.equal(await advanced.evaluate(el => el.open), width >= 1024, 'native disclosure matches the initial responsive layout');
            // Inspect the expanded mobile panel too: hiding it must not hide
            // an overflow defect or make its real controls unreachable.
            if (width < 1024) {
              await advanced.locator('summary').click();
              await page.getByLabel('From year', { exact: true }).waitFor();
              const expanded = await page.evaluate(() => ({
                width: innerWidth, scroll: document.documentElement.scrollWidth,
                outside: [...document.querySelectorAll('main button,main select,main summary')].filter(el => {
                  const r = el.getBoundingClientRect(); return r.width && r.height && (r.x < -1 || r.right > innerWidth + 1);
                }).map(el => el.textContent.trim().slice(0,40)),
              }));
              assert.ok(expanded.scroll <= width + 1, JSON.stringify({width,zoom,expanded}));
              assert.deepEqual(expanded.outside, [], JSON.stringify({width,zoom,expanded}));
              await advanced.locator('summary').click();
              assert.equal(await advanced.evaluate(el => el.open), false);
            }
          }
        }
        results.push({ width, zoom, hash, criticalControlsFit: true });
      }
      await page.close();
    }
    console.log(JSON.stringify({ base, evidence: 'synthetic UI geometry and pointer-hover lifecycle; no root masking', cases: results.length, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
