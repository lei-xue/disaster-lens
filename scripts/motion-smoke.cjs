const assert = require('node:assert/strict');
const { browserType, browserName } = require('./browser-engine.cjs');
const base = process.env.BASE_URL;
assert.ok(base);
(async () => {
  const browser = await browserType.launch();
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
      await page.goto(base + '#/about', { waitUntil: 'networkidle' });
      const link = page.getByRole('link', { name: 'Preparedness', exact: true });
      await link.hover();
      const style = await link.evaluate(e => ({ duration: getComputedStyle(e).transitionDuration, property: getComputedStyle(e).transitionProperty }));
      assert.ok(style.duration.split(',').every(s => parseFloat(s) === (reducedMotion === 'reduce' ? 0 : 0.12)), JSON.stringify(style));
      if (reducedMotion === 'no-preference') assert.ok(!/all|transform|width|height/.test(style.property));
      const before = await link.boundingBox();
      await page.keyboard.press('Tab');
      await link.focus();
      assert.equal(await link.evaluate(e => e.matches(':focus-visible')), true);
      assert.equal(await link.evaluate(e => getComputedStyle(e).transitionDuration), '0s');
      const after = await link.boundingBox();
      assert.deepEqual(after, before, 'feedback must not move navigation or hit targets');
      await page.close();
    }
    // Firefox does not support Playwright isMobile emulation.
    if (browserName !== 'firefox') {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
      await page.goto(base + '#/about', { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('link', { name: 'Preparedness', exact: true }).evaluate(e => getComputedStyle(e).transitionDuration), '0s');
      await page.close();
    }
    console.log('PASS restrained pointer feedback; keyboard/reduced-motion instant; stable geometry');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
