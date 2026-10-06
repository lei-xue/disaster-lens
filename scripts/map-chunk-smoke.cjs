const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL;
assert.ok(base, 'Set BASE_URL to the production build');
(async () => {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage();
    const scripts = [];
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto(base + '#/about', { waitUntil: 'networkidle' });
    assert.ok(!scripts.some(url => /StateChoropleth|DashboardPage/.test(url)), 'About does not download dashboard or map');
    await page.close();
    for (const fail of [false, true]) {
      const p = await browser.newPage();
      await p.route('**/api/open/v2/DisasterDeclarationsSummaries**', route => route.fulfill({ json: { DisasterDeclarationsSummaries: [{ disasterNumber: 400, state: 'CA', declarationTitle: 'SYNTHETIC', incidentType: 'Flood', declarationDate: '2026-01-01T00:00:00.000Z', designatedArea: 'SYNTHETIC County', declarationType: 'DR' }] } }));
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await p.route('**/StateChoropleth-*.js', async route => {
        if (fail) return route.abort();
        await held;
        await route.continue();
      });
      await p.goto(base, { waitUntil: 'domcontentloaded' });
      await p.getByLabel('Loaded data scope').waitFor();
      if (fail) {
        await p.getByRole('alert').filter({ hasText: 'Map unavailable' }).waitFor();
      } else {
        await p.getByRole('status').filter({ hasText: 'Loading map' }).waitFor();
        release();
        await p.locator('.rsm-geography[data-state="CA"]').waitFor();
      }
      assert.ok(await p.getByLabel('State', { exact: true }).isVisible(), 'filters survive pending/failed map');
      assert.ok(await p.getByRole('link', { name: 'Browse loaded records' }).isVisible(), 'record navigation survives');
      await p.close();
    }
    console.log('PASS fresh About excludes map/dashboard; delayed map preserves data; failed map preserves controls and records');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
