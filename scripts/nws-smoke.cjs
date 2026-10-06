// Synthetic NWS browser regression. Never interpret these fixtures as live alerts.
const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8792/';
const collection = (area) => ({ type: 'FeatureCollection', features: [{
  type: 'Feature', geometry: null, id: `https://api.weather.gov/alerts/urn:oid:synthetic.${area}`,
  properties: { id: `urn:oid:synthetic.${area}`, event: `Synthetic ${area} weather warning`,
    headline: `Synthetic warning for ${area}`, areaDesc: 'Synthetic area with a long descriptive name',
    status: 'Actual', messageType: 'Alert', senderName: 'Synthetic NWS office',
    severity: 'Severe', urgency: 'Expected', certainty: 'Likely',
    sent: '2026-01-01T00:00:00Z', expires: '2026-01-02T00:00:00Z', ends: null,
    description: 'Synthetic line one\nSynthetic line two <script>must remain text</script>', instruction: null,
  },
}] });
(async () => {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    const requests = [];
    let mode = 'success';
    await page.route('https://api.weather.gov/alerts/active**', async route => {
      const u = new URL(route.request().url());
      requests.push(u.searchParams.get('area'));
      assert.equal(u.searchParams.get('status'), 'actual');
      assert.equal(u.searchParams.get('message_type'), 'alert,update');
      assert.equal(u.searchParams.has('limit'), false);
      if (mode === 'pending') return;
      const status = mode === 'failure' ? 503 : 200;
      const body = mode === 'empty' ? { type: 'FeatureCollection', features: [] } : collection(u.searchParams.get('area'));
      await route.fulfill({ status, contentType: 'application/geo+json', body: JSON.stringify(body) });
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '#/alerts', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Current weather alerts', exact: true }).waitFor();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    assert.equal(requests.length, 0, 'no inferred-location/initial NWS request');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to main content');
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#/alerts');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    await page.getByLabel('State or territory', { exact: true }).selectOption('CA');
    await page.getByRole('button', { name: 'Load alerts', exact: true }).click();
    await page.getByText('Synthetic CA weather warning', { exact: true }).waitFor();
    const initialAuto = page.getByLabel('Auto-refresh every 5 minutes', { exact: true });
    assert.equal(await initialAuto.isChecked(), false, 'auto refresh is opt-in');
    await initialAuto.check();
    await page.getByLabel('State or territory', { exact: true }).selectOption('TX');
    assert.equal(requests.length, 1, 'draft selection does not fetch');
    assert.equal(await page.getByText('Synthetic CA weather warning', { exact: true }).count(), 1);
    const refreshResponse = page.waitForResponse(r => r.url().includes('api.weather.gov/alerts/active'));
    await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
    await refreshResponse;
    assert.deepEqual(requests, ['CA', 'CA'], 'refresh uses applied snapshot, not draft');
    mode = 'failure';
    await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
    await page.getByText(/stale/i).first().waitFor();
    assert.equal(await page.getByText('Synthetic CA weather warning', { exact: true }).count(), 1, 'last good snapshot retained on failure');
    mode = 'success';
    await page.getByRole('button', { name: 'Load alerts', exact: true }).click();
    await page.getByText('Synthetic TX weather warning', { exact: true }).waitFor();
    assert.equal(await page.getByText('Synthetic CA weather warning', { exact: true }).count(), 0);
    for (const width of [320, 390, 1440]) for (const zoom of [100, 200]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(z => { document.documentElement.style.fontSize = `${z}%`; document.querySelectorAll('details').forEach(d => d.open = true); }, zoom);
      const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert.ok(dims.scroll <= dims.width + 1, `alerts layout ${width}/${zoom}: ${JSON.stringify(dims)}`);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 390, height: 900 });
    const auto = page.getByLabel('Auto-refresh every 5 minutes', { exact: true });
    assert.equal(await auto.isChecked(), true, 'auto mode survives applied-area change');
    const before = requests.length;
    await page.clock.fastForward(299999);
    assert.equal(requests.length, before, 'auto refresh not early');
    const nextResponse = page.waitForResponse(r => r.url().includes('api.weather.gov/alerts/active'));
    await page.clock.fastForward(1);
    await nextResponse;
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1), 'TX', 'auto refresh follows the new applied area, not old CA');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.fastForward(600000);
    assert.equal(requests.length, before + 1, 'hidden visibility suppresses polling');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(requests.length, before + 1, 'returning visible does not cause burst');
    await auto.uncheck();
    await page.clock.fastForward(90000000);
    await page.getByText('Expired since retrieval — not a current warning.', { exact: true }).waitFor();
    assert.equal(requests.length, before + 1, 'disabled auto mode stays off after clock advance');
    mode = 'empty';
    await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
    await page.getByText(/No active alerts/i).first().waitFor();
    assert.match(await page.locator('main').innerText(), /does not mean|not mean|no danger/i);
    mode = 'pending';
    await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
    await page.clock.fastForward(20001);
    await page.getByText(/too long/i).first().waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS NWS synthetic initial/privacy/skip, draft-applied-refresh/stale, 3 widths/200% expanded content, opt-in 5min timer/hidden pause, empty and deadline');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
