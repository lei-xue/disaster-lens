// Unmocked browser evidence for actual FEMA request reuse. Never intercepts responses.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/root/.hermes/profiles/dev-mate/cache/scratch/disasterlens-browser-check/node_modules/playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8792/';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(90000);
    const calls = []; const errors = []; const observations = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname === 'www.fema.gov' && url.pathname === '/api/open/v2/DisasterDeclarationsSummaries') {
        calls.push({ filter: url.searchParams.get('$filter'), skip: url.searchParams.get('$skip') || '0' });
      }
    });
    const ready = async () => {
      await page.getByLabel('Loaded data scope', { exact: true }).waitFor();
      await page.getByText(/^Fetched .*fresh.*cached/).waitFor();
    };
    const nav = name => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
    const idle = () => page.waitForFunction(() => ![...document.querySelectorAll('p[role="status"]')].some(e => e.textContent.includes('Updating data')));
    const observe = (step, before) => observations.push({ step, addedFemaRequests: calls.length - before });
    await page.goto(base, { waitUntil: 'networkidle' }); await ready();
    assert.ok(calls.length > 0, 'initial public-source query actually requested FEMA');
    observe('Initial actual FEMA query', 0);
    const initial = calls.length;
    await nav('Explore'); await page.locator('tbody tr').first().waitFor();
    observe('Dashboard to Explore', initial); assert.equal(calls.length, initial);
    await nav('Dashboard'); await ready();
    observe('Explore back to Dashboard', initial); assert.equal(calls.length, initial);
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await idle(); await ready();
    observe('Identical Apply', initial); assert.equal(calls.length, initial);
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    observe('Full reload', initial); assert.equal(calls.length, initial);
    assert.ok((await page.evaluate(() => indexedDB.databases())).some(db => db.name === 'disasterlens-cache'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    const beforeState = calls.length;
    await page.locator('.rsm-geography[data-state="CA"]').click();
    await page.getByLabel('Loaded data scope').filter({ hasText: /California|\bCA\b/ }).waitFor();
    await ready(); observe('Uncached actual California map selection', beforeState);
    assert.ok(calls.length > beforeState);
    assert.ok(calls.slice(beforeState).every(call => call.filter.includes("state eq 'CA'")));
    const californiaLabel = await page.locator('.rsm-geography[data-state="CA"]').getAttribute('aria-label');
    const currentCount = californiaLabel.match(/^California, (.+?) in the current view\./)?.[1];
    assert.ok(currentCount, 'latest applied state count is exposed accessibly');
    const focusInfo = page.locator('#state-map-focus-info');
    await focusInfo.waitFor();
    assert.ok((await focusInfo.innerText()).includes(currentCount), 'selected-state information must update from capped global counts to the newly applied exact-state snapshot');
    const afterState = calls.length;
    await page.reload({ waitUntil: 'networkidle' }); await ready();
    observe('California full reload', afterState); assert.equal(calls.length, afterState);
    const beforeDetail = calls.length;
    await page.goto(base + '#/disaster/4945', { waitUntil: 'networkidle' }); await page.locator('article').waitFor();
    observe('Independent actual detail 4945', beforeDetail); assert.ok(calls.length > beforeDetail);
    const afterDetail = calls.length;
    const areas = await page.locator('article dd li').allTextContents();
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('article').waitFor();
    observe('Independent detail full reload', afterDetail); assert.equal(calls.length, afterDetail);
    const beforeForce = calls.length;
    const response = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
    await page.getByRole('button', { name: 'Refresh details', exact: true }).click(); await response;
    await page.waitForFunction(() => document.querySelector('article')?.textContent.includes('Fetched'));
    observe('Force detail refresh', beforeForce); assert.ok(calls.length > beforeForce);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ evidence: 'unmocked official FEMA requests; no response interception', baseUrl: base, observations, detail4945Areas: areas, pageErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
