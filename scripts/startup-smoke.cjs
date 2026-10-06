const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL;
assert.ok(base);
(async () => {
  const browser = await browserType.launch();
  try {
    for (const width of [320, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await p.route('**/assets/index-*.js', async route => { await held; await route.continue(); });
      await p.goto(base + '#/about', { waitUntil: 'commit' });
      await p.locator('.dl-boot').waitFor();
      assert.match(await p.locator('.dl-boot').innerText(), /DisasterLens.*Loading dashboard/s);
      assert.ok(await p.locator('.dl-boot svg').isVisible(), 'logo exists before JS or app CSS');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      release();
      await p.getByRole('heading', { name: 'About DisasterLens' }).waitFor();
      assert.equal(await p.locator('.dl-boot').count(), 0, 'React replaces initial loading shell');
      await p.close();
    }
    const p = await browser.newPage();
    await p.route('**/api/open/v2/DisasterDeclarationsSummaries**', route => route.fulfill({ json: { DisasterDeclarationsSummaries: [{ disasterNumber: 400, state: 'CA', declarationTitle: 'SYNTHETIC', incidentType: 'Flood', declarationDate: '2025-01-01T00:00:00.000Z', designatedArea: 'SYNTHETIC County', declarationType: 'DR' }] } }));
    await p.goto(base, { waitUntil: 'networkidle' });
    const bars = p.locator('section[aria-labelledby="state-chart-title"] .recharts-bar-rectangle path');
    await bars.first().waitFor();
    const colors = await bars.evaluateAll(elements => elements.map(e => e.getAttribute('fill')));
    assert.ok(colors.length > 0 && colors.every(color => color === '#c2410c'), JSON.stringify(colors));
    await p.close();
    console.log('PASS pre-JS branded shell at 320/1440, mount replacement and warm-orange state bars');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
