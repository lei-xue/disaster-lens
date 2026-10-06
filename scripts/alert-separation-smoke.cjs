// Synthetic records only; checks alert separation, not current weather.
const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL;
assert.ok(base);
(async () => {
  const browser = await browserType.launch();
  try {
    for (const width of [320, 390, 1440]) for (const zoom of [100, 200]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('https://api.weather.gov/alerts/active**', route => route.fulfill({ json: {
        type: 'FeatureCollection', features: ['Severe', 'Moderate', 'Minor'].map((severity, i) => ({
          type: 'Feature', geometry: null, id: `https://api.weather.gov/alerts/urn:oid:synthetic.boundary.${i}`,
          properties: { id: `urn:oid:synthetic.boundary.${i}`, event: `Synthetic warning ${i}`, headline: 'Synthetic long headline for visual separation testing', areaDesc: 'Synthetic county; '.repeat(25), status: 'Actual', messageType: 'Alert', senderName: 'Synthetic NWS office', severity, urgency: 'Expected', certainty: 'Likely', sent: '2026-01-01T00:00:00Z', expires: '2099-01-01T00:00:00Z', ends: null, description: 'Synthetic description', instruction: 'Synthetic instruction' }
        }))
      } }));
      await page.goto(base + '#/alerts', { waitUntil: 'networkidle' });
      await page.getByLabel('State or territory', { exact: true }).selectOption('CA');
      await page.getByRole('button', { name: 'Load alerts', exact: true }).click();
      await page.locator('.dl-bulletin-record').nth(2).waitFor();
      await page.evaluate(zoom => { document.documentElement.style.fontSize = zoom + '%'; }, zoom);
      const boxes = await page.locator('.dl-bulletin-record').evaluateAll(elements => elements.map(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, border: s.borderTopWidth, accent: s.borderLeftColor, background: s.backgroundColor };
      }));
      assert.equal(boxes.length, 3);
      for (let i = 0; i < boxes.length; i++) {
        assert.equal(boxes[i].border, '1px');
        assert.equal(boxes[i].background, 'rgb(255, 255, 255)');
        assert.ok(boxes[i].left >= 0 && boxes[i].right <= width + 1);
        if (i) assert.ok(boxes[i].top - boxes[i-1].bottom >= 15, 'each alert has a distinct gap');
      }
      assert.equal(new Set(boxes.map(b => b.accent)).size, 3, 'severity color remains distinct');
      await page.locator('.dl-bulletin-record summary').first().click();
      assert.ok(await page.getByText('Synthetic instruction', { exact: true }).first().isVisible());
      assert.equal(await page.getByRole('link', { name: 'Official NWS record (JSON)' }).count(), 3);
      await page.close();
    }
    console.log('PASS distinct alert boundaries, all records/details/source links, 320/390/1440 and 100/200% text');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
