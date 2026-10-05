import type { CacheEntry, DisasterQuery, DisasterResult } from './fema'
import type { DisasterRecord } from './types'
import { US_STATES } from './constants.ts'

/**
 * Bounded, schema-versioned FEMA snapshot cache.
 *
 * Storage layout (all values are JSON strings):
 *   query:<canonicalKey>  -> QueryEnvelope   (max MAX_QUERY_ENTRIES)
 *   detail:<id>           -> DetailEnvelope  (max MAX_DETAIL_ENTRIES)
 *   meta:lastApplied      -> { key: string } canonical key of the last
 *                            successfully applied query
 * Total persisted entries are bounded by 6 queries + 20 details + 1 meta.
 */
export const CACHE_SCHEMA_VERSION = 1
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_QUERY_ENTRIES = 6
export const MAX_DETAIL_ENTRIES = 20
/** Upper bound on records per envelope; mirrors the FEMA page-size ceiling. */
export const MAX_RECORDS_PER_ENVELOPE = 5000
const LAST_APPLIED_KEY = 'meta:lastApplied'
const DEFAULT_OPEN_DEADLINE_MS = 1500

export interface CacheStorageAdapter {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  keys(): Promise<string[]>
}

export interface CacheConfig {
  adapter?: CacheStorageAdapter
  clock?: () => number
  /** Max time to wait for a durable read/write before falling back to memory. */
  deadlineMs?: number
}

interface QueryEnvelope {
  schema: number
  kind: 'query'
  key: string
  query: DisasterQuery
  records: DisasterRecord[]
  limitReached: boolean
  fetchedAt: number
}

interface DetailEnvelope {
  schema: number
  kind: 'detail'
  id: number
  records: DisasterRecord[]
  limitReached: boolean
  fetchedAt: number
}

export interface Snapshot extends DisasterResult {
  fetchedAt: number
  /** True when past TTL; usable as labeled fallback, never as fresh. */
  stale: boolean
  /** True when the snapshot was persisted durably (vs memory-only). */
  durable: boolean
}

export interface QuerySnapshot extends Snapshot {
  query: DisasterQuery
}

function cloneQuery(query: DisasterQuery): DisasterQuery {
  return { ...query, incidentTypes: [...query.incidentTypes] }
}

/** Canonical key: years, state, sorted incident types. */
export function canonicalQueryKey(query: DisasterQuery): string {
  const types = [...query.incidentTypes].sort()
  return JSON.stringify({
    s: query.startYear,
    e: query.endYear,
    st: query.state ?? null,
    t: types,
  })
}

function isValidQuery(value: unknown): value is DisasterQuery {
  if (value === null || typeof value !== 'object') return false
  const q = value as Record<string, unknown>
  if (!Number.isSafeInteger(q.startYear) || !Number.isSafeInteger(q.endYear)) return false
  if (q.state !== null && typeof q.state !== 'string') return false
  return Array.isArray(q.incidentTypes) && q.incidentTypes.every((t) => typeof t === 'string')
}

const VALID_RECORD_STATES = new Set<string>([
  ...US_STATES.map((s) => s.code),
  'FM',
  'MH',
  'PW',
])

const TEXT_FIELDS = [
  'state',
  'declarationTitle',
  'incidentType',
  'declarationDate',
  'designatedArea',
  'declarationType',
] as const

function isValidRecord(record: unknown): record is DisasterRecord {
  if (record === null || typeof record !== 'object') return false
  const r = record as Record<string, unknown>
  if (!Number.isSafeInteger(r.disasterNumber) || (r.disasterNumber as number) <= 0) return false
  if (TEXT_FIELDS.some((field) => typeof r[field] !== 'string')) return false
  if (!VALID_RECORD_STATES.has(r.state as string)) return false
  return !Number.isNaN(Date.parse(r.declarationDate as string))
}

function isValidFetchedAt(value: unknown, now: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= now
}

/* ---------------- adapters ---------------- */

function createMemoryAdapter(): CacheStorageAdapter {
  const map = new Map<string, string>()
  return {
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

function createIdbAdapter(): CacheStorageAdapter | null {
  if (typeof indexedDB === 'undefined') return null
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = (): Promise<IDBDatabase> => {
    if (dbPromise === null) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('disasterlens-cache', CACHE_SCHEMA_VERSION)
        request.onupgradeneeded = () => {
          request.result.createObjectStore('snapshots')
        }
        request.onsuccess = () => {
          const db = request.result
          // Another tab upgrading the schema must not wedge this connection.
          db.onversionchange = () => {
            db.close()
            dbPromise = null
          }
          resolve(db)
        }
        request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
        request.onblocked = () => reject(new Error('IndexedDB open blocked'))
      })
      dbPromise.catch(() => {
        dbPromise = null
      })
    }
    return dbPromise
  }
  const withStore = async <T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open()
    const tx = db.transaction('snapshots', mode)
    const request = run(tx.objectStore('snapshots'))
    // Durable means the transaction committed, not just that the request
    // callback fired. Resolve only on tx.oncomplete; reject on error/abort,
    // surfacing the request error when one occurred first.
    return new Promise<T>((resolve, reject) => {
      let requestError: DOMException | null = null
      request.onerror = () => {
        requestError = request.error
      }
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () =>
        reject(requestError ?? tx.error ?? new Error('IndexedDB transaction failed'))
      tx.onabort = () =>
        reject(requestError ?? tx.error ?? new Error('IndexedDB transaction aborted'))
    })
  }
  return {
    read: (key) => withStore('readonly', (store) => store.get(key)).then((v) => (typeof v === 'string' ? v : null)),
    write: async (key, value) => {
      await withStore('readwrite', (store) => store.put(value, key))
    },
    remove: async (key) => {
      await withStore('readwrite', (store) => store.delete(key))
    },
    keys: async () => {
      const all = await withStore('readonly', (store) => store.getAllKeys())
      return all.filter((k): k is string => typeof k === 'string')
    },
  }
}

/* ---------------- module state ---------------- */

const memory = createMemoryAdapter()
let durable: CacheStorageAdapter | null = null
let durableResolved = false
let clock: () => number = () => Date.now()
let deadlineMs = DEFAULT_OPEN_DEADLINE_MS
/**
 * Keys whose newest value lives only in memory because the durable write
 * failed (e.g. quota). While a key is dirty the durable copy is stale and
 * must never be preferred over memory.
 */
const dirtyMemoryKeys = new Set<string>()

/** Inject adapter/clock for tests. Pass no args to reset to browser defaults. */
export function configureCache(config: CacheConfig = {}): void {
  durable = config.adapter ?? null
  durableResolved = config.adapter !== undefined
  clock = config.clock ?? (() => Date.now())
  deadlineMs = config.deadlineMs ?? DEFAULT_OPEN_DEADLINE_MS
  dirtyMemoryKeys.clear()
}

function withDeadline<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cache deadline')), deadlineMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

/** Resolve the durable adapter once; failures degrade silently to memory. */
async function durableAdapter(): Promise<CacheStorageAdapter | null> {
  if (!durableResolved) {
    durableResolved = true
    durable = createIdbAdapter()
  }
  if (durable === null) return null
  try {
    // Probe the adapter within the deadline; a hanging IDB open must not stall the UI.
    await withDeadline(durable.keys())
    return durable
  } catch {
    durable = null
    return null
  }
}

/* ---------------- persistence helpers ---------------- */

async function readRaw(key: string): Promise<{ value: string | null; durable: boolean }> {
  // A dirty memory copy is newer than anything in durable storage.
  if (dirtyMemoryKeys.has(key)) {
    return { value: await memory.read(key), durable: false }
  }
  const adapter = await durableAdapter()
  if (adapter !== null) {
    try {
      const value = await withDeadline(adapter.read(key))
      if (value !== null) return { value, durable: true }
    } catch {
      // fall through to memory
    }
  }
  return { value: await memory.read(key), durable: false }
}

async function writeRaw(key: string, value: string): Promise<boolean> {
  await memory.write(key, value)
  const adapter = await durableAdapter()
  if (adapter === null) {
    dirtyMemoryKeys.add(key)
    return false
  }
  try {
    await withDeadline(adapter.write(key, value))
    dirtyMemoryKeys.delete(key)
    return true
  } catch {
    // Durable write failed: the new memory snapshot stays readable and the
    // stale durable copy must not be preferred until a write succeeds.
    dirtyMemoryKeys.add(key)
    return false
  }
}

async function removeRaw(key: string): Promise<void> {
  dirtyMemoryKeys.delete(key)
  await memory.remove(key)
  const adapter = await durableAdapter()
  if (adapter !== null) {
    try {
      await withDeadline(adapter.remove(key))
    } catch {
      // best effort
    }
  }
}

async function allRawKeys(): Promise<string[]> {
  const keys = new Set(await memory.keys())
  const adapter = await durableAdapter()
  if (adapter !== null) {
    try {
      for (const key of await withDeadline(adapter.keys())) keys.add(key)
    } catch {
      // memory-only
    }
  }
  return [...keys]
}

/* ---------------- bounded eviction ---------------- */

async function evict(kind: 'query' | 'detail', max: number): Promise<void> {
  const prefix = `${kind}:`
  const keys = (await allRawKeys()).filter((key) => key.startsWith(prefix))
  if (keys.length <= max) return
  const envelopes: Array<{ key: string; fetchedAt: number }> = []
  for (const key of keys) {
    const { value } = await readRaw(key)
    if (value === null) continue
    try {
      const parsed = JSON.parse(value) as { fetchedAt?: unknown }
      envelopes.push({
        key,
        fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
      })
    } catch {
      envelopes.push({ key, fetchedAt: 0 })
    }
  }
  // Oldest-fetchedAt first; insertion heuristic, not true LRU.
  envelopes.sort((a, b) => a.fetchedAt - b.fetchedAt)
  const excess = envelopes.slice(0, Math.max(0, envelopes.length - max))
  for (const entry of excess) {
    await removeRaw(entry.key)
  }
}

/* ---------------- mutation queue ---------------- */

/**
 * Public mutations (saves, mark, clear) are serialized so a slow durable
 * write can never resurrect an entry after a clear that was issued later.
 * Reads are not queued. No shared AbortController: each operation runs to
 * completion independently.
 */
let mutationQueue: Promise<unknown> = Promise.resolve()

function enqueueMutation<T>(op: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(op, op)
  mutationQueue = result.catch(() => undefined)
  return result
}

/* ---------------- envelope parsing ---------------- */

function parseQueryEnvelope(raw: string | null, expectedKey: string, now: number): QueryEnvelope | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const env = parsed as Record<string, unknown>
  if (env.schema !== CACHE_SCHEMA_VERSION || env.kind !== 'query') return null
  if (env.key !== expectedKey) return null
  if (!isValidQuery(env.query)) return null
  if (canonicalQueryKey(env.query) !== expectedKey) return null
  if (!Array.isArray(env.records) || env.records.length > MAX_RECORDS_PER_ENVELOPE) return null
  if (!env.records.every(isValidRecord)) return null
  if (typeof env.limitReached !== 'boolean') return null
  if (!isValidFetchedAt(env.fetchedAt, now)) return null
  return parsed as QueryEnvelope
}

function parseDetailEnvelope(raw: string | null, id: number, now: number): DetailEnvelope | null {
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null
  const env = parsed as Record<string, unknown>
  if (env.schema !== CACHE_SCHEMA_VERSION || env.kind !== 'detail') return null
  if (env.id !== id || !Number.isSafeInteger(env.id)) return null
  if (!Array.isArray(env.records) || env.records.length > MAX_RECORDS_PER_ENVELOPE) return null
  if (!env.records.every(isValidRecord)) return null
  if (typeof env.limitReached !== 'boolean') return null
  if (!isValidFetchedAt(env.fetchedAt, now)) return null
  if ((env.records as DisasterRecord[]).some((r) => r.disasterNumber !== id)) return null
  return parsed as DetailEnvelope
}

/** Drop a corrupt/mismatched entry best-effort; never writes anything. */
async function removeCorrupt(raw: string | null, storageKey: string): Promise<void> {
  if (raw === null) return
  try {
    await removeRaw(storageKey)
  } catch {
    // best effort; a corrupt entry simply misses again next time
  }
}

/* ---------------- public API ---------------- */

/** Read a snapshot for an exact query. Fresh within TTL; stale entries are labeled. */
export async function readQuerySnapshot(query: DisasterQuery): Promise<QuerySnapshot | null> {
  const now = clock()
  const key = canonicalQueryKey(query)
  const storageKey = `query:${key}`
  const { value, durable: wasDurable } = await readRaw(storageKey)
  const env = parseQueryEnvelope(value, key, now)
  if (env === null) {
    await removeCorrupt(value, storageKey)
    return null
  }
  return {
    query: cloneQuery(env.query),
    records: env.records,
    limitReached: env.limitReached,
    fetchedAt: env.fetchedAt,
    stale: now - env.fetchedAt > CACHE_TTL_MS,
    durable: wasDurable,
  }
}

/**
 * Persist a fully validated successful query result and mark it last-applied.
 * Resolves true only when both the snapshot and the meta pointer were
 * persisted durably; a memory-only result resolves false.
 */
export function saveQuerySnapshot(
  query: DisasterQuery,
  result: DisasterResult,
  fetchedAt?: number,
): Promise<boolean> {
  return enqueueMutation(async () => {
    const key = canonicalQueryKey(query)
    const storageKey = `query:${key}`
    const env: QueryEnvelope = {
      schema: CACHE_SCHEMA_VERSION,
      kind: 'query',
      key,
      query: cloneQuery(query),
      records: result.records,
      limitReached: result.limitReached,
      fetchedAt: fetchedAt ?? clock(),
    }
    // Bound only actual insertions: overwriting an existing key adds no entry.
    const existing = await readRaw(storageKey)
    if (existing.value === null) {
      await evict('query', MAX_QUERY_ENTRIES - 1)
    }
    const snapshotDurable = await writeRaw(storageKey, JSON.stringify(env))
    const metaDurable = await writeRaw(LAST_APPLIED_KEY, JSON.stringify({ key }))
    return snapshotDurable && metaDurable
  })
}

/**
 * Point last-applied at an already-cached query without touching its
 * snapshot: fetchedAt, records, and unrelated entries are unchanged.
 * Resolves false (and writes nothing) when no snapshot exists for the query.
 */
export function markQueryApplied(query: DisasterQuery): Promise<boolean> {
  return enqueueMutation(async () => {
    const key = canonicalQueryKey(query)
    const existing = await readRaw(`query:${key}`)
    if (existing.value === null) return false
    return writeRaw(LAST_APPLIED_KEY, JSON.stringify({ key }))
  })
}

/** Read the last successfully applied query snapshot (fresh or labeled stale). */
export async function readLastAppliedSnapshot(): Promise<QuerySnapshot | null> {
  const { value } = await readRaw(LAST_APPLIED_KEY)
  if (value === null) return null
  let key: string | null = null
  try {
    const meta = JSON.parse(value) as { key?: unknown }
    if (typeof meta.key === 'string') key = meta.key
  } catch {
    return null
  }
  if (key === null) return null
  const now = clock()
  const storageKey = `query:${key}`
  const { value: raw, durable: wasDurable } = await readRaw(storageKey)
  const env = parseQueryEnvelope(raw, key, now)
  if (env === null) {
    await removeCorrupt(raw, storageKey)
    return null
  }
  return {
    query: cloneQuery(env.query),
    records: env.records,
    limitReached: env.limitReached,
    fetchedAt: env.fetchedAt,
    stale: now - env.fetchedAt > CACHE_TTL_MS,
    durable: wasDurable,
  }
}

export async function readDetailSnapshot(id: number): Promise<Snapshot | null> {
  const now = clock()
  const storageKey = `detail:${id}`
  const { value, durable: wasDurable } = await readRaw(storageKey)
  const env = parseDetailEnvelope(value, id, now)
  if (env === null) {
    await removeCorrupt(value, storageKey)
    return null
  }
  return {
    records: env.records,
    limitReached: env.limitReached,
    fetchedAt: env.fetchedAt,
    stale: now - env.fetchedAt > CACHE_TTL_MS,
    durable: wasDurable,
  }
}

/**
 * Persist a detail snapshot. Resolves true only when persisted durably;
 * a memory-only result resolves false.
 */
export function saveDetailSnapshot(
  id: number,
  result: DisasterResult,
  fetchedAt?: number,
): Promise<boolean> {
  return enqueueMutation(async () => {
    const storageKey = `detail:${id}`
    const env: DetailEnvelope = {
      schema: CACHE_SCHEMA_VERSION,
      kind: 'detail',
      id,
      records: result.records,
      limitReached: result.limitReached,
      fetchedAt: fetchedAt ?? clock(),
    }
    const existing = await readRaw(storageKey)
    if (existing.value === null) {
      await evict('detail', MAX_DETAIL_ENTRIES - 1)
    }
    return writeRaw(storageKey, JSON.stringify(env))
  })
}

/**
 * Clear memory, durable cache, and the synchronous facade. Never throws;
 * never refetches. Serialized with pending writes so a delayed write that
 * began before the clear cannot resurrect an entry afterwards.
 */
export function clearCache(): Promise<void> {
  return enqueueMutation(async () => {
    syncCache = null
    const keys = await allRawKeys()
    dirtyMemoryKeys.clear()
    for (const key of keys) {
      await memory.remove(key)
    }
    const adapter = await durableAdapter()
    if (adapter !== null) {
      for (const key of keys) {
        try {
          await withDeadline(adapter.remove(key))
        } catch {
          // best effort; memory is already cleared
        }
      }
    }
  })
}

/* -------- synchronous memory facade used by fema.ts's original API -------- */

let syncCache: CacheEntry | null = null

export function syncSet(query: DisasterQuery, result: DisasterResult, fetchedAt: number): void {
  syncCache = {
    query: cloneQuery(query),
    records: result.records,
    limitReached: result.limitReached,
    fetchedAt,
  }
}

export function syncGet(): CacheEntry | null {
  return syncCache
}
