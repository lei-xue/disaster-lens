// Unmocked official FEMA traffic with two callers; no synthetic response fallback.
const assert = require('node:assert/strict');
(async () => {
  const { fetchDisasters } = await import('../src/lib/fema.ts');
  const query = { startYear: 2016, endYear: 2026, state: null, incidentTypes: [] };
  const first = new AbortController(); const second = new AbortController();
  const pageSkips = []; let upstream; let signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const transport = async (input, options) => {
    pageSkips.push(Number(new URL(String(input)).searchParams.get('$skip') || 0));
    upstream = options.signal; signalStarted();
    return fetch(input, { ...options, signal: AbortSignal.any([options.signal, AbortSignal.timeout(30000)]) });
  };
  const cancelled = assert.rejects(fetchDisasters(query, first.signal, transport), { name: 'AbortError' });
  const remaining = fetchDisasters(query, second.signal, transport);
  await started; first.abort(); await cancelled;
  assert.equal(upstream.aborted, false, 'one caller cancelling must not cancel the official-source request for the other');
  const result = await remaining;
  const requiredPages = result.limitReached ? 5 : Math.floor(result.records.length / 1000) + 1;
  assert.equal(pageSkips.length, requiredPages, 'two callers must share the required complete page sequence');
  assert.deepEqual(pageSkips, Array.from({ length: requiredPages }, (_, index) => index * 1000));
  console.log(JSON.stringify({
    evidence: 'unmocked official FEMA requests through source module in Node; not deployment or browser interception',
    concurrentCallers: 2, cancelledCallers: 1,
    upstreamAbortedWhileOtherCallerActive: false,
    requests: pageSkips.length, pageSkips,
    remainingCallerRecords: result.records.length, limitReached: result.limitReached,
  }, null, 2));
})().catch(error => { console.error(error.name, error.message); process.exit(1); });
