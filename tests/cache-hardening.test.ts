import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  canonicalQueryKey, clearCache, configureCache, markQueryApplied,
  readDetailSnapshot, readLastAppliedSnapshot, readQuerySnapshot,
  saveDetailSnapshot, saveQuerySnapshot, syncGet, syncSet,
  MAX_QUERY_ENTRIES, MAX_DETAIL_ENTRIES, type CacheStorageAdapter,
} from '../src/lib/disasterCache.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

// Deliberately synthetic public-data fixtures; never substitute for live evidence.
const now = 1_800_000_000_000
const query = { startYear: 2016, endYear: 2026, state: null as string | null, incidentTypes: [] as string[] }
const row: DisasterRecord = {
  disasterNumber: 4945, state: 'OH', declarationTitle: 'CACHE TEST',
  incidentType: 'Flood', declarationDate: '2026-10-02T00:00:00.000Z',
  designatedArea: 'Test County', declarationType: 'DR',
}
const result = { records: [row], limitReached: false }
function adapter() {
  const map = new Map<string, string>()
  return {
    map,
    read: async (key: string) => map.get(key) ?? null,
    write: async (key: string, value: string) => { map.set(key, value) },
    remove: async (key: string) => { map.delete(key) },
    keys: async () => [...map.keys()],
  } satisfies CacheStorageAdapter & { map: Map<string, string> }
}

beforeEach(async () => {
  configureCache({ adapter: adapter(), clock: () => now })
  await clearCache()
})

describe('cache durability and application metadata', () => {
  it('returns true only after successful durable query and metadata writes', async () => {
    assert.equal(await saveQuerySnapshot(query, result, now), true)
    assert.equal((await readQuerySnapshot(query))?.durable, true)
  })
  it('returns false for unavailable durable storage but still supplies a memory snapshot', async () => {
    configureCache({ clock: () => now })
    assert.equal(await saveQuerySnapshot(query, result, now), false)
    assert.equal((await readQuerySnapshot(query))?.durable, false)
    assert.deepEqual((await readQuerySnapshot(query))?.records, result.records)
  })
  it('prefers new memory data over an older durable copy after a quota failure', async () => {
    const store = adapter()
    configureCache({ adapter: store, clock: () => now })
    await saveQuerySnapshot(query, result, now - 100)
    store.write = async () => { throw new Error('quota') }
    const updated = { records: [{ ...row, declarationTitle: 'NEW MEMORY COPY' }], limitReached: false }
    assert.equal(await saveQuerySnapshot(query, updated, now), false)
    const snapshot = await readQuerySnapshot(query)
    assert.equal(snapshot?.records[0].declarationTitle, 'NEW MEMORY COPY')
    assert.equal(snapshot?.fetchedAt, now)
    assert.equal(snapshot?.durable, false)
  })
  it('marks a cached selection as last applied without refreshing its retrieval timestamp', async () => {
    const ca = { ...query, state: 'CA' }
    await saveQuerySnapshot(query, result, now - 200)
    await saveQuerySnapshot(ca, { records: [{ ...row, state: 'CA' }], limitReached: false }, now - 100)
    assert.equal(await markQueryApplied(query), true)
    const last = await readLastAppliedSnapshot()
    assert.deepEqual(last?.query, query)
    assert.equal(last?.fetchedAt, now - 200)
  })
  it('does not fabricate a snapshot when marking an uncached query', async () => {
    assert.equal(await markQueryApplied(query), false)
    assert.equal(await readLastAppliedSnapshot(), null)
  })
  it('clears the synchronous FEMA facade as well as persistent snapshots', async () => {
    syncSet(query, result, now)
    await saveQuerySnapshot(query, result, now)
    assert.notEqual(syncGet(), null)
    await clearCache()
    assert.equal(syncGet(), null)
    assert.equal(await readQuerySnapshot(query), null)
    assert.equal(await readLastAppliedSnapshot(), null)
  })
  it('serializes a slow pending write before clear so it cannot resurrect deleted snapshots', async () => {
    const store = adapter()
    const write = store.write
    let release!: () => void
    let reached!: () => void
    const writing = new Promise<void>((resolve) => { reached = resolve })
    const blocked = new Promise<void>((resolve) => { release = resolve })
    let first = true
    store.write = async (key, value) => {
      if (first) { first = false; reached(); await blocked }
      await write(key, value)
    }
    configureCache({ adapter: store, clock: () => now })
    const pending = saveQuerySnapshot(query, result, now)
    await writing
    const clearing = clearCache()
    release()
    await Promise.all([pending, clearing])
    assert.equal(await readQuerySnapshot(query), null)
    assert.equal(await readLastAppliedSnapshot(), null)
    assert.equal(store.map.size, 0)
  })
})

describe('cache bounds and corrupted public snapshots', () => {
  it('never exceeds the query limit even when two new keys arrive together', async () => {
    await Promise.all(Array.from({ length: MAX_QUERY_ENTRIES + 2 }, (_, index) =>
      saveQuerySnapshot({ ...query, startYear: 2016 + index }, result, now - index)))
    const valid = await Promise.all(Array.from({ length: MAX_QUERY_ENTRIES + 2 }, (_, index) =>
      readQuerySnapshot({ ...query, startYear: 2016 + index })))
    assert.equal(valid.filter(Boolean).length, MAX_QUERY_ENTRIES)
  })
  it('never exceeds the independent detail-ID limit with concurrent saves', async () => {
    await Promise.all(Array.from({ length: MAX_DETAIL_ENTRIES + 2 }, (_, index) => {
      const id = index + 1
      return saveDetailSnapshot(id, { records: [{ ...row, disasterNumber: id }], limitReached: false }, now - index)
    }))
    const valid = await Promise.all(Array.from({ length: MAX_DETAIL_ENTRIES + 2 }, (_, index) => readDetailSnapshot(index + 1)))
    assert.equal(valid.filter(Boolean).length, MAX_DETAIL_ENTRIES)
  })
  it('rejects a detail envelope containing records for a different disaster ID', async () => {
    await saveDetailSnapshot(1, result, now)
    assert.equal(await readDetailSnapshot(1), null)
  })
  it('rejects invalid states in a persisted query record', async () => {
    const store = adapter()
    configureCache({ adapter: store, clock: () => now })
    await saveQuerySnapshot(query, result, now)
    const key = `query:${canonicalQueryKey(query)}`
    const envelope = JSON.parse(store.map.get(key)!)
    envelope.records[0].state = 'XX'
    store.map.set(key, JSON.stringify(envelope))
    assert.equal(await readQuerySnapshot(query), null)
  })
  it('rejects more than 5,000 records in a persisted envelope', async () => {
    const store = adapter()
    configureCache({ adapter: store, clock: () => now })
    await saveQuerySnapshot(query, result, now)
    const key = `query:${canonicalQueryKey(query)}`
    const envelope = JSON.parse(store.map.get(key)!)
    envelope.records = Array.from({ length: 5001 }, () => row)
    store.map.set(key, JSON.stringify(envelope))
    assert.equal(await readQuerySnapshot(query), null)
  })
  it('falls back within a bounded deadline when IndexedDB enumeration never settles', async () => {
    const store = adapter()
    store.keys = () => new Promise<string[]>(() => {})
    configureCache({ adapter: store, clock: () => now, deadlineMs: 10 })
    const started = performance.now()
    assert.equal(await saveQuerySnapshot(query, result, now), false)
    assert.ok(performance.now() - started < 500, 'hung storage must not stall page loading')
    assert.equal((await readQuerySnapshot(query))?.durable, false)
  })
})
