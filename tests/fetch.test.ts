import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchDisasters, fetchDisasterDetail, parseDisasterNumber, FemaError, setCachedDisasters, getCachedDisasters, MAX_RECORDS } from '../src/lib/fema.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

// Synthetic records only: not live FEMA data.
const row: DisasterRecord = { disasterNumber: 4945, state: 'OH', declarationTitle: 'TEST FLOOD', incidentType: 'Flood', declarationDate: '2026-10-02T00:00:00.000Z', designatedArea: 'Test County', declarationType: 'DR' }
const query = { startYear: 2016, endYear: 2026, state: null, incidentTypes: [] as string[] }
const response = (records: unknown[]) => Response.json({ DisasterDeclarationsSummaries: records })
function paged(total: number, calls: URL[]): typeof fetch {
  return async (input) => {
    const u = new URL(String(input)); calls.push(u)
    const skip = Number(u.searchParams.get('$skip') || 0)
    const top = Number(u.searchParams.get('$top'))
    return response(Array.from({ length: Math.max(0, Math.min(top, total - skip)) }, (_, i) => ({ ...row, designatedArea: `Area ${skip + i}` })))
  }
}
describe('bounded FEMA requests', () => {
  it('loads every page, ends on a short page and preserves ordering', async () => {
    const calls: URL[] = []
    const result = await fetchDisasters(query, undefined, paged(1001, calls))
    assert.equal(result.records.length, 1001); assert.equal(result.limitReached, false)
    assert.deepEqual(calls.map(u => u.searchParams.get('$skip') || '0'), ['0','1000'])
    assert.equal(result.records[1000].designatedArea, 'Area 1000')
  })
  it('requests an empty page after an exact page-size match', async () => {
    const calls: URL[] = []; const result = await fetchDisasters(query, undefined, paged(1000, calls))
    assert.equal(result.limitReached, false); assert.equal(calls.length, 2)
  })
  for (const total of [5000, 5001]) it(`reports possible incompleteness at ${total} without claiming extra records`, async () => {
    const calls: URL[] = []; const result = await fetchDisasters(query, undefined, paged(total, calls))
    assert.equal(result.records.length, MAX_RECORDS); assert.equal(result.limitReached, true); assert.equal(calls.length, 5)
  })
  it('returns an empty completed query', async () => {
    assert.deepEqual(await fetchDisasters(query, undefined, paged(0, [])), { records: [], limitReached: false })
  })
  it('details use independent ID filtering on every page', async () => {
    const calls: URL[] = []; const result = await fetchDisasterDetail(4945, undefined, paged(1001, calls))
    assert.equal(result.records.length, 1001)
    assert.ok(calls.every(u => u.searchParams.get('$filter') === 'disasterNumber eq 4945'))
  })
  it('never accepts a partial result after a later page fails', async () => {
    let count = 0
    await assert.rejects(fetchDisasterDetail(4945, undefined, async () => ++count === 1 ? response(Array(1000).fill(row)) : new Response('', { status: 503 })), /FEMA service/)
  })
  it('details reject an unexpected disaster ID', async () => {
    await assert.rejects(fetchDisasterDetail(123, undefined, async () => response([row])), /different disaster/)
  })
  it('rejects malformed records instead of silently undercounting', async () => {
    for (const bad of [null, { ...row, declarationDate: 'invalid' }, { ...row, state: null }, { disasterNumber: 4945 }]) {
      await assert.rejects(fetchDisasters(query, undefined, async () => response([bad])), /invalid declaration records/)
    }
  })
  it('handles HTTP, invalid JSON, envelope and network errors', async () => {
    await assert.rejects(fetchDisasters(query, undefined, async () => new Response('', { status: 429 })), (e: unknown) => e instanceof FemaError && e.status === 429)
    await assert.rejects(fetchDisasters(query, undefined, async () => new Response('not json')), /could not be read/)
    await assert.rejects(fetchDisasters(query, undefined, async () => Response.json({ wrong: [] })), /unexpected format/)
    await assert.rejects(fetchDisasters(query, undefined, async () => { throw new TypeError('network') }), /Could not reach FEMA/)
  })
  it('aborts before requesting and during a request without success', async () => {
    const first = new AbortController(); first.abort(); let called = false
    await assert.rejects(fetchDisasters(query, first.signal, async () => { called = true; return response([]) }), { name: 'AbortError' }); assert.equal(called, false)
    const second = new AbortController()
    await assert.rejects(fetchDisasters(query, second.signal, async () => { second.abort(); return response([row]) }), { name: 'AbortError' })
  })
  it('rejects invalid route IDs without normalization', async () => {
    for (const id of ['0','-1','01','1.5','1e3','abc',' 2','9007199254740992',undefined]) assert.equal(parseDisasterNumber(id), null)
    assert.equal(parseDisasterNumber('4945'), 4945)
    await assert.rejects(fetchDisasterDetail(-1, undefined, async () => response([])), /Invalid disaster number/)
  })
  it('caches query snapshot and limit metadata together', () => {
    const q = { ...query, incidentTypes: ['Flood'] }
    setCachedDisasters(q, { records: [row], limitReached: true }); q.incidentTypes.push('Fire')
    assert.deepEqual(getCachedDisasters()?.query.incidentTypes, ['Flood']); assert.equal(getCachedDisasters()?.limitReached, true)
  })
})
