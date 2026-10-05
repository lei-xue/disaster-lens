import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  canonicalQueryKey,
  configureCache,
  clearCache,
  readDetailSnapshot,
  readLastAppliedSnapshot,
  readQuerySnapshot,
  saveDetailSnapshot,
  saveQuerySnapshot,
  CACHE_TTL_MS,
  type CacheStorageAdapter,
} from '../src/lib/disasterCache.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

// Synthetic records only: not live FEMA data.
const row: DisasterRecord = {
  disasterNumber: 4945,
  state: 'OH',
  declarationTitle: 'TEST FLOOD',
  incidentType: 'Flood',
  declarationDate: '2026-10-02T00:00:00.000Z',
  designatedArea: 'Test County',
  declarationType: 'DR',
}
const result = { records: [row], limitReached: false }
const query = { startYear: 2016, endYear: 2026, state: null, incidentTypes: [] as string[] }

function memoryAdapter(): CacheStorageAdapter & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    read: async (key) => map.get(key) ?? null,
    write: async (key, value) => {
      map.set(key, value)
    },
    remove: async (key) => {
      map.delete(key)
    },
    keys: async () => [...map.keys()],
  }
}

let now = 1_800_000_000_000

beforeEach(async () => {
  now = 1_800_000_000_000
  configureCache({ adapter: memoryAdapter(), clock: () => now })
  await clearCache()
})

describe('canonical query keys', () => {
  it('is independent of incident type order', () => {
    const a = { ...query, incidentTypes: ['Flood', 'Fire'] }
    const b = { ...query, incidentTypes: ['Fire', 'Flood'] }
    assert.equal(canonicalQueryKey(a), canonicalQueryKey(b))
  })
  it('differs for different state/year/type', () => {
    assert.notEqual(canonicalQueryKey({ ...query, state: 'CA' }), canonicalQueryKey(query))
    assert.notEqual(canonicalQueryKey({ ...query, startYear: 2020 }), canonicalQueryKey(query))
    assert.notEqual(canonicalQueryKey({ ...query, incidentTypes: ['Fire'] }), canonicalQueryKey(query))
  })
})

describe('query snapshots', () => {
  it('round-trips an exact query and misses a different one', async () => {
    await saveQuerySnapshot(query, result, now)
    const hit = await readQuerySnapshot(query)
    assert.equal(hit?.stale, false)
    assert.equal(hit?.records.length, 1)
    const miss = await readQuerySnapshot({ ...query, state: 'CA' })
    assert.equal(miss, null)
  })
  it('matches regardless of incident type order', async () => {
    const unordered = { ...query, incidentTypes: ['Flood', 'Fire'] }
    await saveQuerySnapshot(unordered, result, now)
    const hit = await readQuerySnapshot({ ...query, incidentTypes: ['Fire', 'Flood'] })
    assert.equal(hit?.records.length, 1)
  })
  it('labels entries past the TTL as stale, and exactly at TTL as fresh', async () => {
    await saveQuerySnapshot(query, result, now)
    now = now + CACHE_TTL_MS
    assert.equal((await readQuerySnapshot(query))?.stale, false)
    now = now + 1
    const expired = await readQuerySnapshot(query)
    assert.equal(expired?.stale, true)
    assert.equal(expired?.records.length, 1)
  })
  it('rejects malformed, wrong-schema and future-timestamp envelopes', async () => {
    await saveQuerySnapshot(query, result, now)
    const adapter = memoryAdapter()
    configureCache({ adapter, clock: () => now })
    const key = `query:${canonicalQueryKey(query)}`
    adapter.map.set(key, 'not json')
    assert.equal(await readQuerySnapshot(query), null)
    adapter.map.set(key, JSON.stringify({ schema: 99, kind: 'query' }))
    assert.equal(await readQuerySnapshot(query), null)
    adapter.map.set(
      key,
      JSON.stringify({
        schema: 1,
        kind: 'query',
        key: canonicalQueryKey(query),
        query,
        records: [row],
        limitReached: false,
        fetchedAt: now + 60_000,
      }),
    )
    assert.equal(await readQuerySnapshot(query), null)
    adapter.map.set(
      key,
      JSON.stringify({
        schema: 1,
        kind: 'query',
        key: canonicalQueryKey(query),
        query,
        records: [{ ...row, state: null }],
        limitReached: false,
        fetchedAt: now,
      }),
    )
    assert.equal(await readQuerySnapshot(query), null)
  })
  it('restores the last applied snapshot', async () => {
    const other = { ...query, state: 'CA' }
    await saveQuerySnapshot(query, result, now)
    await saveQuerySnapshot(other, { records: [row, row], limitReached: true }, now)
    const last = await readLastAppliedSnapshot()
    assert.equal(last?.query.state, 'CA')
    assert.equal(last?.records.length, 2)
    assert.equal(last?.limitReached, true)
  })
  it('caches a successful zero-record payload', async () => {
    await saveQuerySnapshot(query, { records: [], limitReached: false }, now)
    const hit = await readQuerySnapshot(query)
    assert.deepEqual(hit?.records, [])
    assert.equal(hit?.stale, false)
  })
})

describe('detail snapshots', () => {
  it('keeps detail entries keyed separately by ID', async () => {
    await saveDetailSnapshot(1, { records: [{ ...row, disasterNumber: 1 }], limitReached: false }, now)
    await saveDetailSnapshot(2, { records: [{ ...row, disasterNumber: 2 }], limitReached: false }, now)
    assert.equal((await readDetailSnapshot(1))?.records[0].disasterNumber, 1)
    assert.equal((await readDetailSnapshot(2))?.records[0].disasterNumber, 2)
    assert.equal(await readDetailSnapshot(3), null)
  })
  it('rejects detail envelopes whose records belong to another disaster', async () => {
    await saveDetailSnapshot(5, result, now)
    assert.equal(await readDetailSnapshot(5), null)
  })
})

describe('failure fallback and clear', () => {
  it('survives a failing durable adapter via memory fallback', async () => {
    const failing: CacheStorageAdapter = {
      read: async () => {
        throw new Error('blocked')
      },
      write: async () => {
        throw new Error('quota')
      },
      remove: async () => {
        throw new Error('blocked')
      },
      keys: async () => {
        throw new Error('blocked')
      },
    }
    configureCache({ adapter: failing, clock: () => now })
    await saveQuerySnapshot(query, result, now)
    const hit = await readQuerySnapshot(query)
    assert.equal(hit?.records.length, 1)
    assert.equal(hit?.durable, false)
  })
  it('clears both memory and durable data', async () => {
    await saveQuerySnapshot(query, result, now)
    await saveDetailSnapshot(1, result, now)
    await clearCache()
    assert.equal(await readQuerySnapshot(query), null)
    assert.equal(await readDetailSnapshot(1), null)
    assert.equal(await readLastAppliedSnapshot(), null)
  })
})
