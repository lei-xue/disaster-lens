import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildActiveAlertsUrl,
  fetchActiveAlerts,
  getAlertEndMs,
  isOfficialRecordUrl,
  MAX_RENDERED_ALERTS,
  NwsError,
} from '../src/lib/nws.ts'
import type { AlertRecord } from '../src/lib/nws.ts'

// Synthetic records only: not live NWS data.
const props = {
  id: 'urn:oid:2.49.0.1.840.0.test.1',
  event: 'Test Flood Warning',
  headline: 'Test headline',
  areaDesc: 'Test County',
  senderName: 'NWS Test Office',
  severity: 'Moderate',
  certainty: 'Likely',
  urgency: 'Expected',
  sent: '2026-10-03T12:00:00-07:00',
  expires: '2026-10-05T12:00:00-07:00',
  ends: '2026-10-04T12:00:00-07:00',
  description: 'Test description',
  instruction: 'Test instruction',
  status: 'Actual',
  messageType: 'Alert',
}
const feature = (overrides: Record<string, unknown> = {}) => ({
  id: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.test.1',
  type: 'Feature',
  geometry: null,
  properties: { ...props, ...overrides },
})
const collection = (features: unknown[]) => Response.json({ type: 'FeatureCollection', features })
const abortError = () => new DOMException('This operation was aborted', 'AbortError')

describe('buildActiveAlertsUrl', () => {
  it('builds the official filtered query for a valid allowlisted code', () => {
    const url = new URL(buildActiveAlertsUrl('CA'))
    assert.equal(url.origin, 'https://api.weather.gov')
    assert.equal(url.pathname, '/alerts/active')
    assert.deepEqual([...url.searchParams.entries()].sort(), [
      ['area', 'CA'],
      ['message_type', 'alert,update'],
      ['status', 'actual'],
    ])
  })
  it('rejects malformed area literals without normalization and without any request', async () => {
    for (const bad of ['XX', 'ca', ' CA', 'C1', '', 'CALIFORNIA']) {
      assert.throws(() => buildActiveAlertsUrl(bad), NwsError)
      let called = false
      await assert.rejects(fetchActiveAlerts(bad, undefined, async () => { called = true; return collection([]) }), NwsError)
      assert.equal(called, false)
    }
  })
})

describe('fetchActiveAlerts parsing', () => {
  it('parses a valid payload with null geometry and null optional fields', async () => {
    const result = await fetchActiveAlerts('CA', undefined, async () =>
      collection([{ id: 'urn:not-a-url', type: 'Feature', geometry: null, properties: { ...props, instruction: null, headline: null } }]))
    assert.equal(result.totalReturned, 1)
    assert.equal(result.limitReached, false)
    assert.equal(result.records[0].event, 'Test Flood Warning')
    assert.equal(result.records[0].instruction, null)
    assert.equal(result.records[0].headline, null)
    assert.equal(result.records[0].sourceUrl, null)
  })
  it('uses Feature.id as the official record link only when it validates', async () => {
    const result = await fetchActiveAlerts('CA', undefined, async () => collection([feature()]))
    assert.equal(result.records[0].sourceUrl, 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.test.1')
    const bad = await fetchActiveAlerts('CA', undefined, async () =>
      collection([{ ...feature(), id: 'http://www.weather.gov', properties: { ...props, '@id': 'http://example.com/x' } }]))
    assert.equal(bad.records[0].sourceUrl, null)
  })
  it('filters out non-Actual status and Cancel/test message types defensively', async () => {
    const result = await fetchActiveAlerts('CA', undefined, async () =>
      collection([
        feature({ sent: '2026-10-03T12:00:00-07:00' }),
        feature({ status: 'Test' }),
        feature({ status: 'Exercise' }),
        feature({ messageType: 'Cancel' }),
        feature({ messageType: 'Update', sent: '2026-10-04T12:00:00-07:00' }),
      ]))
    assert.equal(result.totalReturned, 2)
    assert.ok(result.records.every((r) => r.event === 'Test Flood Warning'))
  })
  it('handles an empty feature list', async () => {
    assert.deepEqual(await fetchActiveAlerts('CA', undefined, async () => collection([])), {
      records: [],
      totalReturned: 0,
      limitReached: false,
    })
  })
  it('keeps every record at exactly the render cap and truncates truthfully beyond it', async () => {
    const exact = await fetchActiveAlerts('CA', undefined, async () => collection(Array.from({ length: MAX_RENDERED_ALERTS }, () => feature())))
    assert.equal(exact.records.length, MAX_RENDERED_ALERTS)
    assert.equal(exact.limitReached, false)
    assert.equal(exact.totalReturned, MAX_RENDERED_ALERTS)
    const over = await fetchActiveAlerts('CA', undefined, async () =>
      collection(Array.from({ length: MAX_RENDERED_ALERTS + 100 }, (_, i) => feature({ sent: `2026-10-03T${String(i % 24).padStart(2, '0')}:00:00-07:00` }))))
    assert.equal(over.records.length, MAX_RENDERED_ALERTS)
    assert.equal(over.totalReturned, MAX_RENDERED_ALERTS + 100)
    assert.equal(over.limitReached, true)
  })
  it('sorts newest first with unknown sent dates last', async () => {
    const result = await fetchActiveAlerts('CA', undefined, async () =>
      collection([
        feature({ id: 'a', sent: '2026-10-01T00:00:00-07:00' }),
        feature({ id: 'b', sent: null }),
        feature({ id: 'c', sent: '2026-10-03T00:00:00-07:00' }),
        feature({ id: 'd', sent: 'not a date' }),
      ]))
    assert.deepEqual(result.records.map((r) => r.id), ['c', 'a', 'b', 'd'])
  })
  it('throws the whole payload away on malformed structure or missing identity', async () => {
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => Response.json({ wrong: [] })), /unexpected format/)
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => Response.json('nope')), /unexpected format/)
    await assert.rejects(
      fetchActiveAlerts('CA', undefined, async () => Response.json({ type: 'Feature', features: [feature()] })),
      /unexpected format/,
    )
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => collection([null])), /unexpected format/)
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => collection([{ properties: { event: 'x' } }])), /unexpected format/)
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => collection([{ properties: { ...props, event: 5 } }])), /unexpected format/)
  })
})

describe('fetchActiveAlerts errors', () => {
  it('maps HTTP errors to friendly NwsError messages with status', async () => {
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => new Response('', { status: 429 })), (e: unknown) => {
      assert.ok(e instanceof NwsError); assert.equal(e.status, 429); assert.match(e.message, /rate limiting/)
      return true
    })
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => new Response('', { status: 500 })), (e: unknown) => {
      assert.ok(e instanceof NwsError); assert.equal(e.status, 500); assert.match(e.message, /unavailable/)
      return true
    })
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => new Response('', { status: 404 })), /could not find/)
  })
  it('rejects invalid JSON and network failures', async () => {
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => new Response('not json', { status: 200 })), /could not be read/)
    await assert.rejects(fetchActiveAlerts('CA', undefined, async () => { throw new TypeError('network') }), /Could not reach/)
  })
  it('preserves abort before, during, and after JSON parsing', async () => {
    const first = new AbortController(); first.abort()
    let called = false
    await assert.rejects(fetchActiveAlerts('CA', first.signal, async () => { called = true; return collection([]) }), { name: 'AbortError' })
    assert.equal(called, false)
    const second = new AbortController()
    await assert.rejects(fetchActiveAlerts('CA', second.signal, async () => { second.abort(); throw abortError() }), { name: 'AbortError' })
    const third = new AbortController()
    const res = collection([feature()])
    await assert.rejects(fetchActiveAlerts('CA', third.signal, async () => ({
      ...res,
      ok: true,
      status: 200,
      json: async () => { third.abort(); return { type: 'FeatureCollection', features: [feature()] } },
    }) as unknown as Response), { name: 'AbortError' })
  })
  it('propagates caller abort even when the fake fetch ignores the signal', async () => {
    const controller = new AbortController()
    await assert.rejects(
      fetchActiveAlerts('CA', controller.signal, async () => { controller.abort(); return collection([feature()]) }),
      { name: 'AbortError' },
    )
  })
  it('rejects requests and slow JSON parses that exceed the deadline', async () => {
    await assert.rejects(
      fetchActiveAlerts('CA', undefined, async () => new Promise<Response>(() => {}), 25),
      /too long/,
    )
    await assert.rejects(
      fetchActiveAlerts('CA', undefined, async () => ({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}),
      }) as unknown as Response, 25),
      /too long/,
    )
  })
})

describe('getAlertEndMs and isOfficialRecordUrl', () => {
  const base: Pick<AlertRecord, 'ends' | 'expires'> = { ends: null, expires: null }
  it('uses the earliest finite date among ends and expires', () => {
    const end = Date.parse('2026-10-04T12:00:00-07:00')
    const exp = Date.parse('2026-10-05T12:00:00-07:00')
    assert.equal(getAlertEndMs({ ends: '2026-10-04T12:00:00-07:00', expires: '2026-10-05T12:00:00-07:00' }), end)
    assert.equal(getAlertEndMs({ ends: null, expires: '2026-10-05T12:00:00-07:00' }), exp)
    assert.equal(getAlertEndMs({ ends: '2026-10-05T12:00:00-07:00', expires: '2026-10-04T12:00:00-07:00' }), end)
    assert.equal(getAlertEndMs(base), null)
    assert.equal(getAlertEndMs({ ends: 'garbage', expires: 'also garbage' }), null)
    assert.equal(getAlertEndMs({ ends: 'garbage', expires: '2026-10-05T12:00:00-07:00' }), exp)
  })
  it('validates only exact api.weather.gov HTTPS alert record URLs', () => {
    assert.equal(isOfficialRecordUrl('https://api.weather.gov/alerts/urn:oid:1'), true)
    assert.equal(isOfficialRecordUrl('https://api.weather.gov/alerts/active/abc'), true)
    assert.equal(isOfficialRecordUrl('http://api.weather.gov/alerts/1'), false)
    assert.equal(isOfficialRecordUrl('https://www.weather.gov/alerts/1'), false)
    assert.equal(isOfficialRecordUrl('http://www.weather.gov'), false)
    assert.equal(isOfficialRecordUrl('https://api.weather.gov/zones/1'), false)
    assert.equal(isOfficialRecordUrl('https://user:pass@api.weather.gov/alerts/1'), false)
    assert.equal(isOfficialRecordUrl('not a url'), false)
    assert.equal(isOfficialRecordUrl(null), false)
  })
})
