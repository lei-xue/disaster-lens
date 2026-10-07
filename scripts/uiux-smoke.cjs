// UI/UX smoke against the BUILT app with synthetic intercepted OpenFEMA records.
// Usage: PLAYWRIGHT_MODULE=/abs/path/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/uiux-smoke.cjs
const assert = require('node:assert/strict');
const { browserType } = require('./browser-engine.cjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8792/';

// Synthetic fixture: 2 states, 2 years, 2 incident types; detail disaster 4945.
const rec = (n, st, yr, type, area) => ({
  disasterNumber: n, state: st,
  declarationTitle: `SYNTHETIC ${type} ${n}`,
  incidentType: type, declarationDate: `${yr}-06-15T00:00:00.000Z`,
  designatedArea: area, declarationType: 'DR',
});
const listPayload = { DisasterDeclarationsSummaries: [
  rec(101, 'CA', 2020, 'Fire', 'Alpha County'),
  rec(102, 'CA', 2020, 'Fire', 'Beta County'),
  rec(103, 'TX', 2021, 'Hurricane', 'Gamma County'),
  rec(104, 'TX', 2021, 'Hurricane', 'Delta County'),
] };
const detailPayload = { DisasterDeclarationsSummaries: [
  rec(4945, 'OH', 2021, 'Hurricane', 'Zeta County'),
  rec(4945, 'OH', 2021, 'Hurricane', 'Eta County'),
] };

async function newPage(browser, width, extra = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, ...extra });
  page.on('pageerror', (e) => { throw new Error(`pageerror: ${e.message}`); });
  await page.route('**/api/open/v2/DisasterDeclarationsSummaries**', (route) => {
    const url = route.request().url();
    const filter = new URL(url).searchParams.get('$filter') || '';
    const body = filter.includes('disasterNumber eq') ? detailPayload : listPayload;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return page;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const pressSkip = async (page, hash) => {
  await page.keyboard.press('Tab'); // fresh load: first tab stop must be the skip link
  assert.equal(await page.getByRole('link', { name: 'Skip to main content' }).count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to main content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => location.hash), hash, 'hash unchanged after skip link');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content', 'focus on main');
};

(async () => {
  const browser = await browserType.launch({ headless: true });
  try {
    // 1. Skip link + route titles on all 6 hash routes (fresh page per route).
    const routes = [
      ['#/', 'FEMA disaster declarations', 'Dashboard — DisasterLens'],
      ['#/disasters', 'Explore declarations', 'Explore declarations — DisasterLens'],
      ['#/disaster/4945', 'SYNTHETIC Hurricane 4945', 'Declaration details — DisasterLens'],
      ['#/preparedness', 'Preparedness', 'Preparedness guide — DisasterLens'],
      ['#/alerts', 'Current weather alerts', 'Current weather alerts — DisasterLens'],
      ['#/about', 'About DisasterLens', 'About — DisasterLens'],
    ];
    for (const [hash, heading, title] of routes) {
      const page = await newPage(browser, 390);
      await page.goto(base + hash, { waitUntil: 'networkidle' });
      if (hash === '#/') await page.getByLabel('Loaded data scope').waitFor();
      else if (hash === '#/disaster/4945') await page.locator('article').waitFor();
      await page.getByRole('heading', { name: heading, exact: false }).first().waitFor({ state: 'attached' });
      assert.equal(await page.title(), title, `title for ${hash}`);
      await pressSkip(page, hash);
      await page.close();
    }
    console.log('PASS skip-link (first tab stop, hash unchanged, main focused) + titles on 6 routes');

    // 2. No page overflow at 320/390/1440, default and 200% root font.
    // Check every route after its content is committed; collect failures so
    // other checks still execute, then fail the process at the final gate.
    const overflowFails = [];
    for (const width of [320, 390, 1440]) {
      for (const zoom of [1, 2]) {
        for (const [hash, heading] of routes) {
          const page = await newPage(browser, width);
          await page.goto(base + hash, { waitUntil: 'networkidle' });
          await page.getByRole('heading', { name: heading, exact: false }).first().waitFor({ state: 'attached' });
          if (hash === '#/') await page.getByLabel('Loaded data scope').waitFor();
          if (hash === '#/disasters') await page.locator('tbody tr').first().waitFor();
          await page.evaluate((z) => { document.documentElement.style.fontSize = `${z * 100}%`; }, zoom);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          if (!(await noOverflow(page))) overflowFails.push(`${hash} ${width}px @${zoom * 100}%`);
          await page.close();
        }
      }
    }
    console.log(overflowFails.length === 0
      ? 'PASS no horizontal page overflow 320/390/1440 at default and 200% root font'
      : `FAIL overflow: ${overflowFails.join('; ')}`);

    // 3. Reduced-motion: skeleton static while a request is pending.
    {
      const page = await newPage(browser, 390, { reducedMotion: 'reduce' });
      await page.unroute('**/api/open/v2/DisasterDeclarationsSummaries**');
      await page.route('**/api/open/v2/**', () => {}); // never resolves -> pending
      await page.goto(base + '#/', { waitUntil: 'domcontentloaded' });
      const skel = page.locator('.animate-pulse').first();
      await skel.waitFor();
      const anim = await skel.evaluate((el) => getComputedStyle(el).animationName);
      assert.equal(anim, 'none', 'skeleton pulse disabled under reduced motion');
      await page.close();
      console.log('PASS reduced-motion skeleton is static during pending request');
    }

    // 4. Touch targets >=44px on nav, Apply filters, pagination.
    {
      const page = await newPage(browser, 390);
      await page.goto(base + '#/', { waitUntil: 'networkidle' });
      await page.getByLabel('Loaded data scope').waitFor();
      // The redesigned mobile workspace intentionally collapses advanced
      // filters. Exercise the real disclosure before measuring its controls.
      const advanced = page.locator('details.dl-filter-details');
      if (await advanced.count() && !(await advanced.evaluate(el => el.open))) {
        await advanced.locator('summary').click();
      }
      const boxes = await page.evaluate(() => {
        const sel = [
          'nav[aria-label="Main navigation"] a',
          'button[aria-pressed]',
        ].join(',');
        return [...document.querySelectorAll(sel)].map((el) => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent.trim().slice(0, 20), h: r.height, w: r.width };
        });
      });
      assert.ok(boxes.length >= 5, 'nav and filter-chip target selectors must match');
      for (const b of boxes) assert.ok(b.h >= 44, `target >=44px: ${b.text} is ${b.h}px`);
      const applyBox = await page.getByRole('button', { name: 'Apply filters', exact: true }).boundingBox();
      assert.ok(applyBox.height >= 44, 'Apply filters target >=44px');
      await page.goto(base + '#/disasters', { waitUntil: 'networkidle' });
      await page.locator('tbody tr').first().waitFor();
      const pg = page.getByRole('button', { name: 'Next', exact: true });
      const pb = await pg.boundingBox();
      assert.ok(pb.height >= 44, `pagination Next ${pb.height}px`);
      await page.close();
      console.log('PASS >=44px targets: nav links, Apply filters, pagination');
    }

    // 5. Explore: region label, caption, keyboard sorting; map/year text alternatives.
    {
      const page = await newPage(browser, 390);
      await page.goto(base + '#/disasters', { waitUntil: 'networkidle' });
      await page.locator('tbody tr').first().waitFor();
      const region = page.getByRole('region', { name: /scroll horizontally/ });
      assert.ok(await region.count() === 1, 'labeled scroll region present');
      assert.match(await page.locator('caption').innerText(), /declaration records/i);

      const titleBtn = page.getByRole('button', { name: 'Title', exact: false });
      await titleBtn.focus();
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim().startsWith('Title')), true);
      await page.keyboard.press('Enter'); // keyboard-activate sort
      await page.waitForFunction(() => document.querySelector('th[aria-sort="ascending"] button')?.textContent.trim().startsWith('Title'));
      assert.deepEqual(await page.locator('tbody tr td:first-child a').allTextContents(),
        ['SYNTHETIC Fire 101', 'SYNTHETIC Fire 102', 'SYNTHETIC Hurricane 103', 'SYNTHETIC Hurricane 104']);
      await page.close();

      const dash = await newPage(browser, 390);
      await dash.goto(base + '#/', { waitUntil: 'networkidle' });
      await dash.getByLabel('Loaded data scope').waitFor();
      const map = dash.locator('[role="group"][aria-label*="Map of declaration record counts"]');
      await map.waitFor();
      assert.equal(await map.count(), 1, 'interactive map exposes a named group, not an image hiding controls');
      assert.equal(await map.getByRole('button').count(), 51, 'all 50 state paths plus DC expose interactive controls');
      assert.equal(await map.locator('[data-state="CA"]').getAttribute('role'), 'button');
      await dash.locator('details', { hasText: 'text table' }).first().locator('summary').click();
      assert.match(await dash.locator('details', { hasText: 'text table' }).first().innerText(), /CA|TX/);
      assert.match(await dash.getByText(/Highest:/).first().innerText(), /CA|TX/);
      await dash.getByText('Declaration records per year (text table', { exact: false }).first().waitFor();
      await dash.close();
      console.log('PASS Explore region/caption + keyboard sort; map and year-chart HTML text alternatives');
    }

    assert.deepEqual(overflowFails, [], 'all routes must fit at default and 200% text');
    console.log('PASS ALL uiux-smoke checks (synthetic intercepted records; no live FEMA traffic)');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
