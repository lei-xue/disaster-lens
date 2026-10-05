// Synthetic browser regression for cache reuse and real SVG state interaction.
// Build first; PLAYWRIGHT_MODULE and BASE_URL select the external test runtime/preview.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/root/.hermes/profiles/dev-mate/cache/scratch/disasterlens-browser-check/node_modules/playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8792/';
const cacheOnly = process.argv.includes('--cache-only');
const record = (id, state, area) => ({ disasterNumber: id, state, declarationTitle: `SYNTHETIC ${state} disaster ${id}`, incidentType: 'Flood', declarationDate: '2026-01-01T00:00:00.000z', designatedArea: area, declarationType: 'DR' });
const all = [record(101, 'CA', 'Alpha County'), record(102, 'CA', 'Beta County'), record(103, 'TX', 'Gamma County'), record(104, 'TX', 'Delta County')];
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    const calls = []; const errors = [];
    let fail = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/open/v2/DisasterDeclarationsSummaries**', route => {
      const url = new URL(route.request().url());
      const filter = url.searchParams.get('$filter') || '';
      calls.push(filter);
      const detail = filter.match(/disasterNumber eq (\d+)/);
      const area = filter.match(/state eq '([A-Z]{2})'/)?.[1];
      const records = detail ? [record(Number(detail[1]), 'CA', 'Detail County')] : area ? all.filter(r => r.state === area) : all;
      return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ DisasterDeclarationsSummaries: records }) });
    });
    const loaded = async () => {
      await page.getByLabel('Loaded data scope', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Apply filters', exact: true }).waitFor();
    };
    const nav = name => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name, exact: true }).click();
    const scope = () => page.getByLabel('Loaded data scope', { exact: true }).innerText();
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.goto(base, { waitUntil: 'networkidle' });
    await loaded();
    assert.equal(calls.length, 1, 'one synthetic short-page initial request');
    const initial = calls.length;
    await nav('Explore'); await page.locator('tbody tr').first().waitFor();
    await nav('Dashboard'); await loaded(); await settle();
    assert.equal(calls.length, initial, 'Dashboard/Explore/return does not fetch again');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await loaded(); await settle();
    assert.equal(calls.length, initial, 'identical Apply uses the successful snapshot');
    await page.reload({ waitUntil: 'networkidle' }); await loaded();
    assert.equal(calls.length, initial, 'fresh snapshot survives full reload');
    assert.ok((await page.evaluate(() => indexedDB.databases())).length > 0, 'durable IndexedDB cache exists');

    if (!cacheOnly) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const california = page.locator('.rsm-geography[data-state="CA"]');
      assert.equal(await page.locator('.rsm-geography').count(), 51, 'real 50 states plus DC paths');
      assert.equal(await california.getAttribute('role'), 'button');
      assert.match(await california.getAttribute('aria-label'), /California/);
      assert.ok((await california.getAttribute('d')).length > 100, 'not a rectangle/tile replacement');
      const response = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
      await california.click(); await response;
      await page.waitForFunction(() => document.querySelector('select[id*="state"]')?.value === 'CA');
      await page.getByLabel('Loaded data scope').filter({ hasText: /California|\bCA\b/ }).waitFor();
      assert.equal(await california.getAttribute('aria-pressed'), 'true');
      await california.focus();
      assert.equal(await california.evaluate(e => getComputedStyle(e).outlineStyle), 'none', 'focus feedback follows shape, not a rectangle');
      assert.ok(await california.evaluate(e => parseFloat(getComputedStyle(e).strokeWidth) >= 2), 'shape stroke remains visible for focus');
    } else {
      await page.getByLabel('State', { exact: true }).selectOption('CA');
      const response = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click(); await response;
      await page.getByLabel('Loaded data scope').filter({ hasText: /California|\bCA\b/ }).waitFor();
    }
    const afterState = calls.length;
    await page.reload({ waitUntil: 'networkidle' }); await loaded();
    assert.match(await scope(), /California|\bCA\b/, 'restored labels remain tied to applied query');
    assert.equal(calls.length, afterState, 'selected-state snapshot survives reload');

    await page.getByLabel('State', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByLabel('Loaded data scope').filter({ hasText: /All states/ }).waitFor();
    await page.getByLabel('State', { exact: true }).selectOption('CA');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByLabel('Loaded data scope').filter({ hasText: /California|\bCA\b/ }).waitFor();
    await page.reload({ waitUntil: 'networkidle' }); await loaded();
    assert.match(await scope(), /California|\bCA\b/, 'cached A/B/A selection updates the last-applied pointer');
    assert.equal(calls.length, afterState, 'switching between cached queries never refetches or resets freshness');

    await page.goto(base + '#/disaster/4945', { waitUntil: 'networkidle' });
    await page.locator('article').waitFor();
    const afterDetail = calls.length;
    await nav('Explore'); await page.locator('tbody tr').first().waitFor();
    await page.goto(base + '#/disaster/4945', { waitUntil: 'networkidle' });
    await page.locator('article').waitFor();
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('article').waitFor();
    assert.equal(calls.length, afterDetail, 'independent detail snapshot cached across revisit/reload');
    const detailResponse = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
    await page.getByRole('button', { name: 'Refresh details', exact: true }).click(); await detailResponse;
    assert.equal(calls.length, afterDetail + 1, 'explicit details refresh bypasses cache');
    await page.locator('article').waitFor(); await settle();
    fail = true;
    const detailFailure = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
    await page.getByRole('button', { name: 'Refresh details', exact: true }).click(); await detailFailure;
    await page.getByText(/stale snapshot/i).waitFor();
    assert.match(await page.locator('article').innerText(), /Detail County/, 'failed detail refresh retains the previously loaded designated areas');
    fail = false;

    await nav('Dashboard'); await loaded();
    fail = true;
    const oldScope = await scope();
    const failResponse = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
    await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await failResponse;
    await page.getByText(/stale/i).first().waitFor();
    assert.equal(await scope(), oldScope, 'failed refresh cannot relabel last good query');
    await page.getByRole('group').filter({ has: page.locator('.rsm-geography') }).first().waitFor();
    fail = false;
    const refreshResponse = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
    await page.getByRole('button', { name: 'Retry', exact: true }).click(); await refreshResponse;
    await loaded();
    if (!cacheOnly) {
      const tx = page.locator('.rsm-geography[data-state="TX"]');
      const texasResponse = page.waitForResponse(r => r.url().includes('/api/open/v2/DisasterDeclarationsSummaries'));
      await tx.focus(); await page.keyboard.press('Enter'); await texasResponse;
      await page.getByLabel('Loaded data scope').filter({ hasText: /Texas|\bTX\b/ }).waitFor();
      const beforeSpace = calls.length;
      await tx.focus(); await page.keyboard.press('Space'); await settle();
      assert.equal(calls.length, beforeSpace, 'Space activation of same applied state uses cache');
      assert.equal(await tx.getAttribute('aria-pressed'), 'true');
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await settle();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `cache/map controls fit ${width}px at 200% text`);
      if (!cacheOnly) {
        await page.locator('.rsm-geography[data-state="PA"]').focus();
        const tip = page.locator('#state-map-focus-info');
        await tip.waitFor();
        assert.match(await tip.innerText(), /Pennsylvania/);
        const bounds = await tip.boundingBox();
        assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `full-name tooltip fits ${width}px at 200% text`);
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { document.body.style.zoom = '200%'; });
      await settle();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `cache/map controls fit ${width}px at 200% page zoom`);
      if (!cacheOnly) {
        await page.locator('.rsm-geography[data-state="PA"]').focus();
        const tip = page.locator('#state-map-focus-info'); await tip.waitFor();
        const bounds = await tip.boundingBox();
        assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `tooltip fits ${width}px at 200% page zoom`);
      }
    }
    await page.evaluate(() => { document.body.style.zoom = ''; });

    const appliedScope = await scope();
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('disasterlens-cache', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        const cursor = tx.objectStore('snapshots').openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) return;
          const envelope = JSON.parse(item.value);
          if (typeof envelope.fetchedAt === 'number') {
            envelope.fetchedAt -= 24 * 60 * 60 * 1000 + 1000;
            item.update(JSON.stringify(envelope));
          }
          item.continue();
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }));
    fail = true;
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(/stale snapshot/i).first().waitFor();
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    assert.equal(await scope(), appliedScope, 'expired snapshot survives source failure without changing its applied scope');
    const expectedState = cacheOnly ? 'CA' : 'TX';
    assert.match(calls.at(-1), new RegExp(`state eq '${expectedState}'`), 'expiry refresh uses the last applied state, not default all-states query');
    await nav('Explore');
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    await page.getByText(/Stale snapshot/i).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 2, 'expired Explore preserves exact state rows after a failed refresh');
    assert.match(calls.at(-1), new RegExp(`state eq '${expectedState}'`));
    await page.goto(base + '#/disaster/4945', { waitUntil: 'networkidle' });
    await page.getByText(/stale snapshot/i).waitFor();
    assert.match(await page.locator('article').innerText(), /Detail County/, 'expired independent detail remains visible after source failure');
    fail = false;
    await nav('Dashboard');
    await page.getByText(/^Fetched .*fresh.*cached/).waitFor();
    await loaded();
    const beforeClear = calls.length;
    await page.getByRole('button', { name: /Clear cached data|Clear cache/ }).click(); await settle();
    assert.equal(calls.length, beforeClear, 'clear does not automatically request data');
    await page.reload({ waitUntil: 'networkidle' }); await loaded();
    assert.equal(calls.length, beforeClear + 1, 'clear removes durable snapshot, next entry fetches');
    assert.deepEqual(errors, []);
    console.log(`PASS ${cacheOnly ? 'cache' : 'cache + SVG map'} synthetic fresh navigation/apply/reload and cached A/B/A, independent detail reuse/refresh/failure, stale scope and forced retry, text/page 200% layout and tooltips, expired Dashboard/Explore/detail fallback, durable clear; no page errors`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
