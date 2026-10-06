const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL;
assert.ok(base, 'Set BASE_URL to the built artifact');
(async () => {
  const browser = await browserType.launch();
  try {
    for (const width of [320, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/AboutPage-*.js', route => route.abort());
      await page.goto(base + '#/about', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Page unavailable' }).waitFor();
      assert.ok(await page.getByRole('navigation', { name: 'Main navigation' }).isVisible());
      assert.ok(await page.getByLabel('Website build information').isVisible());
      const reload = page.getByRole('button', { name: 'Reload page' });
      await reload.focus();
      assert.ok(await reload.evaluate(element => document.activeElement === element));
      await page.getByRole('link', { name: 'Preparedness', exact: true }).click();
      await page.locator('h1').filter({ hasNotText: 'Page unavailable' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Page unavailable' }).count(), 0);
      // A failed lazy import stays rejected until the document is reloaded.
      await page.getByRole('link', { name: 'About', exact: true }).click();
      await page.getByRole('heading', { name: 'Page unavailable' }).waitFor();
      await page.unroute('**/AboutPage-*.js');
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.getByRole('button', { name: 'Reload page' }).click()]);
      await page.getByRole('heading', { name: 'About DisasterLens' }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0);
      await page.close();
    }
    console.log('PASS failed route chunk preserves shell; navigation recovers; explicit reload retries at 320/1440');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
