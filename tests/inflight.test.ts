import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchDisasters, fetchDisasterDetail, FemaError } from '../src/lib/fema.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

// Synthetic transports and rows only; this suite never requests FEMA.
const row: DisasterRecord = {
  disasterNumber: 4945, state: 'OH', declarationTitle: 'INFLIGHT TEST',
  incidentType: 'Flood', declarationDate: '2026-10-02T00:00:00.000Z',
  designatedArea: 'Test County', declarationType: 'DR',
}
const query = { startYear: 2016, endYear: 2026, state: null, incidentTypes: [] as string[] }
const response = (records: DisasterRecord[] = [row]) => Response.json({ DisasterDeclarationsSummaries: records })
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('subscriber did not settle promptly')), 500)
  })
  try { return await Promise.race([promise, deadline]) } finally { clearTimeout(timer) }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('shared complete FEMA flights', () => {
  it('shares every page of identical simultaneous queries, not just the first page', async () => {
    const started = deferred<void>(); const gate = deferred<void>(); const skips: number[] = []
    const request: typeof fetch = async (input) => {
      const url = new URL(String(input)); const skip = Number(url.searchParams.get('$skip') || 0)
      skips.push(skip); started.resolve()
      if (skip === 0) await gate.promise
      return response(Array.from({ length: skip === 0 ? 1000 : 1 }, (_, index) => ({ ...row, designatedArea: `Area ${skip + index}` })))
    }
    const first = fetchDisasters(query, undefined, request)
    const second = fetchDisasters({ ...query, incidentTypes: [] }, undefined, request)
    await started.promise; gate.resolve()
    const [a, b] = await Promise.all([first, second])
    assert.deepEqual(skips, [0, 1000]); assert.equal(a.records.length, 1001)
    assert.deepEqual(a, b); assert.equal(a.limitReached, false)
  })
  it('shares unordered incident types without mutating caller arrays', async () => {
    let calls = 0; const gate = deferred<void>(); const started = deferred<void>()
    const request: typeof fetch = async () => { calls++; started.resolve(); await gate.promise; return response() }
    const a = { ...query, incidentTypes: ['Flood', 'Fire'] }
    const b = { ...query, incidentTypes: ['Fire', 'Flood'] }
    const first = fetchDisasters(a, undefined, request); const second = fetchDisasters(b, undefined, request)
    await started.promise; gate.resolve(); await Promise.all([first, second])
    assert.equal(calls, 1); assert.deepEqual(a.incidentTypes, ['Flood', 'Fire'])
    assert.deepEqual(b.incidentTypes, ['Fire', 'Flood'])
  })
  it('isolates different query states and different injected transport identities', async () => {
    const gate = deferred<void>(); let callsA = 0; let callsB = 0
    const a: typeof fetch = async () => { callsA++; await gate.promise; return response() }
    const b: typeof fetch = async () => { callsB++; await gate.promise; return response() }
    const results = [fetchDisasters(query, undefined, a), fetchDisasters({ ...query, state: 'CA' }, undefined, a), fetchDisasters(query, undefined, b)]
    await tick(); gate.resolve(); await Promise.all(results)
    assert.equal(callsA, 2); assert.equal(callsB, 1)
  })
  it('does not collide a literal comma-bearing incident type with two separate types', async () => {
    const gate = deferred<void>(); const filters: string[] = []
    const request: typeof fetch = async (input) => {
      filters.push(new URL(String(input)).searchParams.get('$filter')!)
      await gate.promise; return response()
    }
    const a = fetchDisasters({ ...query, incidentTypes: ['Fire,Flood'] }, undefined, request)
    const b = fetchDisasters({ ...query, incidentTypes: ['Fire', 'Flood'] }, undefined, request)
    await tick(); gate.resolve(); await Promise.all([a, b])
    assert.equal(filters.length, 2, 'exact array boundaries must be preserved in keys')
    assert.notEqual(filters[0], filters[1])
  })
  it('does not reuse completed results as an implicit network cache', async () => {
    let calls = 0
    const request: typeof fetch = async () => { calls++; return response() }
    await fetchDisasters(query, undefined, request); await fetchDisasters(query, undefined, request)
    assert.equal(calls, 2)
  })
  it('evicts failed flights so Retry really calls the transport again', async () => {
    let calls = 0
    const request: typeof fetch = async () => ++calls === 1 ? new Response('', { status: 503 }) : response()
    await assert.rejects(fetchDisasters(query, undefined, request), (error: unknown) => error instanceof FemaError && error.status === 503)
    assert.equal((await fetchDisasters(query, undefined, request)).records.length, 1)
    assert.equal(calls, 2)
  })
  it('snapshots caller query values before deferred transport and paging', async () => {
    const mutable = { ...query, incidentTypes: ['Flood'] }
    const gate = deferred<void>(); const started = deferred<void>(); const filters: string[] = []
    const request: typeof fetch = async (input) => {
      const url = new URL(String(input)); filters.push(url.searchParams.get('$filter')!)
      const skip = Number(url.searchParams.get('$skip') || 0)
      if (skip === 0) { started.resolve(); await gate.promise }
      return response(skip === 0 ? Array(1000).fill(row) : [])
    }
    const result = fetchDisasters(mutable, undefined, request)
    mutable.incidentTypes.push('Fire'); mutable.startYear = 2025
    await started.promise; gate.resolve(); await result
    assert.equal(filters.length, 2)
    assert.ok(filters.every(filter => filter.includes('2016-01-01') && !filter.includes("incidentType eq 'Fire'")))
  })
  it('shares independently validated detail IDs while separating list and other ID requests', async () => {
    const gate = deferred<void>(); const filters: string[] = []
    const request: typeof fetch = async (input) => {
      const filter = new URL(String(input)).searchParams.get('$filter')!
      filters.push(filter); await gate.promise
      const id = Number(filter.match(/disasterNumber eq (\d+)/)?.[1] || 4945)
      return response([{ ...row, disasterNumber: id }])
    }
    const results = [fetchDisasterDetail(4945, undefined, request), fetchDisasterDetail(4945, undefined, request), fetchDisasterDetail(4946, undefined, request), fetchDisasters(query, undefined, request)]
    await tick(); gate.resolve(); await Promise.all(results)
    assert.equal(filters.length, 3)
    assert.equal(filters.filter(filter => filter === 'disasterNumber eq 4945').length, 1)
  })
  it('rejects a shared detail ID mismatch for all consumers and does not retain that failure', async () => {
    const gate = deferred<void>(); let calls = 0
    const request: typeof fetch = async () => { calls++; await gate.promise; return response() }
    const a = assert.rejects(fetchDisasterDetail(123, undefined, request), /different disaster/)
    const b = assert.rejects(fetchDisasterDetail(123, undefined, request), /different disaster/)
    await tick(); gate.resolve(); await Promise.all([a, b]); assert.equal(calls, 1)
    await assert.rejects(fetchDisasterDetail(123, undefined, request), /different disaster/)
    assert.equal(calls, 2)
  })
})

describe('subscriber-owned cancellation', () => {
  it('never starts an upstream request for a pre-aborted subscriber', async () => {
    const controller = new AbortController(); controller.abort(); let calls = 0
    await assert.rejects(fetchDisasters(query, controller.signal, async () => { calls++; return response() }), { name: 'AbortError' })
    assert.equal(calls, 0)
  })
  it('rejects one cancelled consumer promptly without aborting a remaining consumer', async () => {
    const started = deferred<void>(); const gate = deferred<void>(); let upstream!: AbortSignal; let calls = 0
    const request: typeof fetch = async (_input, options) => {
      calls++; upstream = options!.signal!; started.resolve(); await gate.promise; return response()
    }
    const a = new AbortController(); const b = new AbortController()
    const first = fetchDisasters(query, a.signal, request)
    const second = fetchDisasters(query, b.signal, request)
    const rejected = assert.rejects(first, { name: 'AbortError' })
    await started.promise; a.abort()
    try {
      await bounded(rejected); assert.equal(upstream.aborted, false)
    } finally { gate.resolve() }
    assert.equal((await second).records.length, 1); assert.equal(calls, 1)
  })
  it('aborts upstream only when all consumers have cancelled, even if transport ignores signals', async () => {
    const started = deferred<void>(); const gate = deferred<void>(); let upstream!: AbortSignal; let calls = 0
    const request: typeof fetch = async (_input, options) => {
      calls++; upstream = options!.signal!; started.resolve(); await gate.promise; return response()
    }
    const a = new AbortController(); const b = new AbortController()
    const first = assert.rejects(fetchDisasters(query, a.signal, request), { name: 'AbortError' })
    const second = assert.rejects(fetchDisasters(query, b.signal, request), { name: 'AbortError' })
    await started.promise; a.abort(); b.abort()
    try {
      await bounded(Promise.all([first, second])); assert.equal(upstream.aborted, true); assert.equal(calls, 1)
    } finally { gate.resolve(); await tick() }
  })
  it('allows immediate retry and prevents late abandoned settlement deleting the replacement flight', async () => {
    const oldGate = deferred<void>(); const newGate = deferred<void>()
    const oldStarted = deferred<void>(); const newStarted = deferred<void>(); let calls = 0
    const request: typeof fetch = async () => {
      const call = ++calls
      if (call === 1) { oldStarted.resolve(); await oldGate.promise }
      else { newStarted.resolve(); await newGate.promise }
      return response()
    }
    const controller = new AbortController()
    const rejected = assert.rejects(fetchDisasters(query, controller.signal, request), { name: 'AbortError' })
    await oldStarted.promise; controller.abort()
    let replacement: Promise<unknown> | undefined
    let joined: Promise<unknown> | undefined
    try {
      await bounded(rejected)
      replacement = fetchDisasters(query, undefined, request); await newStarted.promise
      oldGate.resolve(); await tick()
      joined = fetchDisasters(query, undefined, request)
      await tick(); assert.equal(calls, 2, 'late old cleanup must not remove the new live flight')
    } finally {
      oldGate.resolve(); newGate.resolve(); await Promise.all([replacement, joined])
    }
  })
  it('rejects promptly during JSON parsing that ignores abort', async () => {
    const parsing = deferred<void>(); const json = deferred<unknown>(); let upstream!: AbortSignal
    const request: typeof fetch = async (_input, options) => {
      upstream = options!.signal!
      return { ok: true, status: 200, json: () => { parsing.resolve(); return json.promise } } as Response
    }
    const controller = new AbortController()
    const rejected = assert.rejects(fetchDisasters(query, controller.signal, request), { name: 'AbortError' })
    await parsing.promise; controller.abort()
    try { await bounded(rejected); assert.equal(upstream.aborted, true) }
    finally { json.resolve({ DisasterDeclarationsSummaries: [row] }); await tick() }
  })
  it('detaches abort listeners on success so a late caller abort cannot affect other work', async () => {
    const controller = new AbortController(); const signals: AbortSignal[] = []
    const request: typeof fetch = async (_input, options) => { signals.push(options!.signal!); return response() }
    await fetchDisasters(query, controller.signal, request)
    controller.abort(); assert.equal(signals[0].aborted, false)
    await fetchDisasters(query, undefined, request); assert.equal(signals.length, 2)
  })
})
