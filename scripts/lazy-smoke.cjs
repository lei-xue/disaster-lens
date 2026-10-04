// Real built-artifact route/chunk checks. No OpenFEMA interception or app dependencies added.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8792/';
(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const route of ['#/about', '#/preparedness', '#/alerts', '#/disasters', '#/disaster/4945', '#/']) {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      const assets = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (new URL(request.url()).pathname.endsWith('.js')) assets.push(new URL(request.url()).pathname);
      });
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
      if (route === '#/') await page.getByLabel('Loaded data scope').waitFor({ timeout: 60000 });
      if (route === '#/disasters') await page.locator('tbody tr').first().waitFor({ timeout: 60000 });
      if (route === '#/disaster/4945') await page.locator('article').waitFor({ timeout: 60000 });
      assert.equal(await page.locator('h1').count(), 1);
      assert.deepEqual(errors, []);
      if (route !== '#/') assert.ok(!assets.some(a => a.includes('DashboardPage')), 'non-dashboard entry must not request DashboardPage chunk');
      results.push({ route, title: await page.title(), assets, errors });
      await page.close();
    }
    assert.ok(results.find(r => r.route === '#/').assets.some(a => a.includes('DashboardPage')), 'dashboard loads its own chunk');
    const page = await browser.newPage();
    const held = [];
    await page.route('**/assets/DashboardPage-*.js', route => { held.push(route); });
    await page.goto(base + '#/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('status').filter({ hasText: 'Loading page' }).waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to main content');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    assert.equal(await page.title(), 'Dashboard — DisasterLens');
    assert.equal(held.length, 1, 'pending test must actually hold the dashboard chunk');
    await held[0].continue();
    await page.getByLabel('Loaded data scope').waitFor({ timeout: 60000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    await page.close();
    // React Router transitions may retain the previous page until a lazy
    // chunk resolves; do not require a fallback to flash on navigation.
    const navigation = await browser.newPage();
    await navigation.goto(base + '#/about', { waitUntil: 'networkidle' });
    await navigation.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard', exact: true }).click();
    await navigation.getByLabel('Loaded data scope').waitFor({ timeout: 60000 });
    assert.equal(await navigation.evaluate(() => document.activeElement.id), 'main-content');
    assert.equal(await navigation.title(), 'Dashboard — DisasterLens');
    await navigation.close();
    console.log(JSON.stringify(results, null, 2));
    console.log('PASS real route entries, dashboard deferred requests, and persistent shell/focus/title during held lazy chunk');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
