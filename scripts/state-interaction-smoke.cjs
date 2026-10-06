// Synthetic interaction regressions. No fixtures are injected into application code.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL;
assert.ok(base, 'Set BASE_URL explicitly to the intended built artifact');

async function fixture(page, calls) {
  await page.route('**/api/open/v2/DisasterDeclarationsSummaries**', route => {
    const filter = new URL(route.request().url()).searchParams.get('$filter') || '';
    calls.push(filter);
    const selected = filter.match(/state eq '([A-Z]{2})'/)?.[1];
    const states = selected ? [selected] : ['CA', 'TX'];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      DisasterDeclarationsSummaries: states.map((state, index) => ({
        disasterNumber: 400 + index, state, declarationTitle: 'SYNTHETIC state interaction',
        incidentType: 'Flood', declarationDate: '2026-01-01T00:00:00.000Z',
        designatedArea: 'SYNTHETIC County', declarationType: 'DR',
      })),
    }) });
  });
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: touch ? 390 : 1440, height: 1000 }, isMobile: touch, hasTouch: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await fixture(page, []);
      await page.goto(base, { waitUntil: 'networkidle' });
      const scope = page.getByLabel('Loaded data scope', { exact: true });
      await scope.waitFor();
      if (touch) {
        for (const scale of [100, 200]) {
          await page.evaluate(value => { document.documentElement.style.fontSize = value + '%'; }, scale);
          const sizes = await page.locator('main select,main input,main textarea').evaluateAll(elements => elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
          assert.ok(sizes.length > 0 && sizes.every(size => size >= (scale === 200 ? 32 : 16)), 'coarse inputs respect the 16px minimum and 200% text enlargement');
        }
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      }
      const california = page.locator('.rsm-geography[data-state="CA"]');
      if (touch) await california.tap(); else await california.click();
      await scope.filter({ hasText: /\bCA\b|California/ }).waitFor();
      if (!touch) await page.mouse.move(1, 1);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByRole('tooltip').isVisible(), false, 'click/leave or touch must not retain the central box');
      assert.equal(await california.getAttribute('aria-pressed'), 'true');
      assert.equal(await california.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
      if (!touch) {
        await page.keyboard.press('Tab');
        await california.focus();
        const info = page.locator('#state-map-focus-info');
        await info.waitFor();
        assert.match(await info.innerText(), /California/);
        const bounds = await info.boundingBox();
        const map = await page.getByRole('group', { name: /Map of declaration record counts/ }).boundingBox();
        assert.ok(bounds && map && (bounds.y >= map.y + map.height - 1 || bounds.x >= map.x + map.width - 1 || bounds.x + bounds.width <= map.x + 1), 'keyboard information stays outside geography');
        await page.getByLabel('State', { exact: true }).focus();
        assert.equal(await info.isVisible(), false);
      } else {
        const advanced = page.locator('details.dl-filter-details');
        assert.equal(await advanced.evaluate(el => el.open), false);
        await advanced.locator('summary').focus();
        await page.keyboard.press('Enter');
        await page.getByLabel('From year', { exact: true }).selectOption('2020');
        await page.getByRole('button', { name: 'Fire', exact: true }).tap();
        await page.getByLabel('State', { exact: true }).selectOption('TX');
        await scope.filter({ hasText: /\bTX\b|Texas/ }).waitFor();
        assert.equal(await page.getByLabel('From year', { exact: true }).inputValue(), '2020');
        await page.getByRole('button', { name: 'Apply filters', exact: true }).tap();
        await scope.filter({ hasText: /2020/ }).waitFor();
        await page.getByRole('button', { name: 'Reset', exact: true }).tap();
        await scope.filter({ hasText: /All states/ }).waitFor();
        await advanced.locator('summary').tap();
        assert.equal(await advanced.evaluate(el => el.open), false);
        assert.equal(await page.getByRole('tooltip').isVisible(), false);
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${touch ? 'touch emulation' : 'mouse and keyboard'} state lifecycle at ${base}`);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const calls = [];
    await fixture(page, calls);
    await page.goto(base, { waitUntil: 'networkidle' });
    const scope = page.getByLabel('Loaded data scope', { exact: true });
    await scope.waitFor();
    const year = page.getByLabel('From year', { exact: true });
    const fire = page.getByRole('button', { name: 'Fire', exact: true });
    const state = page.getByLabel('State', { exact: true });
    await year.selectOption('2020');
    await fire.click();
    await state.selectOption('CA');
    await scope.filter({ hasText: /\bCA\b|California/ }).waitFor();
    assert.equal(await year.inputValue(), '2020');
    assert.equal(await fire.getAttribute('aria-pressed'), 'true');
    assert.ok(calls.at(-1).includes('2016-01-01'), 'state-only query uses the applied year');
    assert.ok(!calls.at(-1).includes("incidentType eq 'Fire'"), 'draft incident is not submitted by a state change');
    const prior = calls.length;
    await state.selectOption('');
    await scope.filter({ hasText: /All states/ }).waitFor();
    assert.equal(calls.length, prior, 'exact cached nationwide query is reused');
    await page.locator('.rsm-geography[data-state="TX"]').click();
    await scope.filter({ hasText: /\bTX\b|Texas/ }).waitFor();
    assert.equal(await state.inputValue(), 'TX');
    assert.equal(await year.inputValue(), '2020');
    assert.equal(await fire.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await scope.filter({ hasText: /2020/ }).waitFor();
    assert.ok(calls.at(-1).includes('2020-01-01'));
    assert.ok(calls.at(-1).includes("incidentType eq 'Fire'"));
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await scope.filter({ hasText: /All states/ }).waitFor();
    assert.equal(await state.inputValue(), '');
    assert.equal(await year.inputValue(), '2016');
    assert.equal(await fire.getAttribute('aria-pressed'), 'false');
    await page.close();
    console.log(`PASS immediate map/dropdown state contract, draft preservation, cache reuse, Apply and Reset at ${base}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
