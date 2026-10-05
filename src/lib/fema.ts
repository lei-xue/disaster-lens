import type { DisasterRecord } from './types'

export const FEMA_BASE_URL =
  'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries'

export const PAGE_SIZE = 1000
export const MAX_RECORDS = 5000

const SELECT_FIELDS =
  'disasterNumber,state,declarationTitle,incidentType,declarationDate,designatedArea,declarationType'

export interface DisasterQuery {
  startYear: number
  endYear: number
  state: string | null
  incidentTypes: string[]
}

export class FemaError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'FemaError'
    this.status = status
  }
}

function encode(value: string): string {
  return encodeURIComponent(value)
}

export function buildDisasterQueryUrl(
  query: DisasterQuery,
  top: number = PAGE_SIZE,
  skip: number = 0,
): string {
  const filters = [
    `declarationDate ge '${query.startYear}-01-01T00:00:00.000z'`,
    `declarationDate le '${query.endYear}-12-31T23:59:59.999z'`,
  ]
  if (query.state !== null && query.state !== '') {
    filters.push(`state eq '${query.state}'`)
  }
  if (query.incidentTypes.length > 0) {
    const typeClause = query.incidentTypes
      .map((type) => `incidentType eq '${type}'`)
      .join(' or ')
    filters.push(`(${typeClause})`)
  }

  const params = [
    `$select=${encode(SELECT_FIELDS)}`,
    `$filter=${encode(filters.join(' and '))}`,
    `$orderby=${encode('declarationDate desc')}`,
    `$top=${top}`,
  ]
  if (skip > 0) {
    params.push(`$skip=${skip}`)
  }
  return `${FEMA_BASE_URL}?${params.join('&')}`
}

export function extractRecords(payload: unknown): DisasterRecord[] {
  if (Array.isArray(payload)) {
    return payload as DisasterRecord[]
  }
  if (payload !== null && typeof payload === 'object') {
    const container = (payload as Record<string, unknown>)
      .DisasterDeclarationsSummaries
    if (Array.isArray(container)) {
      return container as DisasterRecord[]
    }
  }
  throw new FemaError('FEMA returned data in an unexpected format.')
}

function friendlyHttpMessage(status: number): string {
  if (status === 400) return 'FEMA rejected the request as invalid. Try adjusting the filters.'
  if (status === 404) return 'The FEMA data endpoint could not be found.'
  if (status === 429) return 'FEMA is limiting requests right now. Wait a moment and try again.'
  if (status >= 500) return 'The FEMA service is having trouble. Please try again shortly.'
  return `The FEMA request failed (HTTP ${status}).`
}

export interface DisasterResult {
  records: DisasterRecord[]
  /** Reaching the bound does not prove there are more records. */
  limitReached: boolean
}

export function parseDisasterNumber(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

export function buildDisasterDetailUrl(number: number, top = PAGE_SIZE, skip = 0): string {
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new FemaError('Invalid disaster number.')
  }
  return `${FEMA_BASE_URL}?$select=${encode(SELECT_FIELDS)}` +
    `&$filter=${encode(`disasterNumber eq ${number}`)}` +
    `&$orderby=${encode('declarationDate desc')}&$top=${top}` +
    (skip > 0 ? `&$skip=${skip}` : '')
}

async function fetchPages(
  buildUrl: (top: number, skip: number) => string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<DisasterResult> {
  const all: DisasterRecord[] = []
  let skip = 0
  while (all.length < MAX_RECORDS) {
    signal?.throwIfAborted()
    const top = Math.min(PAGE_SIZE, MAX_RECORDS - all.length)
    const url = buildUrl(top, skip)
    let response: Response
    try {
      response = await request(url, { signal })
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw err
      throw new FemaError('Could not reach FEMA. Check your connection and try again.')
    }
    if (!response.ok) {
      throw new FemaError(friendlyHttpMessage(response.status), response.status)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch (err) {
      if (signal?.aborted) throw err
      throw new FemaError('FEMA returned a response that could not be read.')
    }
    signal?.throwIfAborted()
    const records = extractRecords(payload)
    const textFields = ['state', 'declarationTitle', 'incidentType', 'declarationDate', 'designatedArea', 'declarationType'] as const
    if (records.length > top || records.some((record) =>
      !record || !Number.isSafeInteger(record.disasterNumber) || record.disasterNumber <= 0 ||
      textFields.some((field) => typeof record[field] !== 'string') ||
      Number.isNaN(Date.parse(record.declarationDate)))) {
      throw new FemaError('FEMA returned invalid declaration records. No partial result was accepted.')
    }
    all.push(...records)
    if (records.length < top) return { records: all, limitReached: false }
    skip += records.length
  }
  return { records: all, limitReached: true }
}

// In-flight request coalescing, keyed per transport identity so injected
// fetch functions never share flights with each other or the global fetch.
interface SharedFlight {
  promise: Promise<DisasterResult>
  controller: AbortController
  consumers: number
  settled: boolean
}

const flightRegistry = new WeakMap<typeof fetch, Map<string, SharedFlight>>()

function flightsFor(transport: typeof fetch): Map<string, SharedFlight> {
  let map = flightRegistry.get(transport)
  if (!map) {
    map = new Map()
    flightRegistry.set(transport, map)
  }
  return map
}

function abortError(): Error {
  return typeof DOMException === 'function'
    ? new DOMException('The operation was aborted.', 'AbortError')
    : Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
}

function shareFlight(
  transport: typeof fetch,
  key: string,
  start: (signal: AbortSignal) => Promise<DisasterResult>,
  signal?: AbortSignal,
): Promise<DisasterResult> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? abortError())
  const registry = flightsFor(transport)
  let flight = registry.get(key)
  if (!flight) {
    const controller = new AbortController()
    const newFlight: SharedFlight = {
      promise: Promise.resolve().then(() => start(controller.signal)),
      controller,
      consumers: 0,
      settled: false,
    }
    registry.set(key, newFlight)
    const cleanup = () => {
      if (registry.get(key) === newFlight) registry.delete(key)
    }
    newFlight.promise.then(
      (value) => {
        newFlight.settled = true
        cleanup()
        return value
      },
      (error: unknown) => {
        newFlight.settled = true
        cleanup()
        throw error
      },
    ).catch(() => {
      // Swallow the settlement-branch rejection; every consumer attaches
      // its own handler via subscribe(). This prevents unhandled rejections
      // after all consumers have cancelled.
    })
    flight = newFlight
  }
  return subscribe(flight, registry, key, signal)
}

function subscribe(
  flight: SharedFlight,
  registry: Map<string, SharedFlight>,
  key: string,
  signal?: AbortSignal,
): Promise<DisasterResult> {
  return new Promise<DisasterResult>((resolve, reject) => {
    let done = false
    const detach = () => {
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      if (done) return
      done = true
      detach()
      flight.consumers -= 1
      if (flight.consumers <= 0 && !flight.settled) {
        // Evict before aborting so an immediate retry starts a fresh flight
        // even if the old transport ignores the abort.
        if (registry.get(key) === flight) registry.delete(key)
        flight.controller.abort(signal?.reason)
      }
      reject(signal?.reason ?? abortError())
    }
    flight.consumers += 1
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    flight.promise.then(
      (value) => {
        if (done) return
        done = true
        detach()
        flight.consumers -= 1
        resolve(value)
      },
      (error: unknown) => {
        if (done) return
        done = true
        detach()
        flight.consumers -= 1
        reject(error)
      },
    )
  })
}

function queryKey(query: DisasterQuery): string {
  return `query:${JSON.stringify([
    String(query.startYear),
    String(query.endYear),
    query.state,
    [...query.incidentTypes].sort(),
  ])}`
}

function detailKey(number: number): string {
  return `d:${number}`
}

export function fetchDisasters(query: DisasterQuery, signal?: AbortSignal, request?: typeof fetch): Promise<DisasterResult> {
  // Clone synchronously so later caller mutation cannot alter key or request.
  const snapshot: DisasterQuery = {
    startYear: query.startYear,
    endYear: query.endYear,
    state: query.state,
    incidentTypes: [...query.incidentTypes],
  }
  const transport = request ?? fetch
  return shareFlight(transport, queryKey(snapshot), (upstream) =>
    fetchPages((top, skip) => buildDisasterQueryUrl(snapshot, top, skip), upstream, transport), signal)
}

export function fetchDisasterDetail(number: number, signal?: AbortSignal, request?: typeof fetch): Promise<DisasterResult> {
  const transport = request ?? fetch
  return shareFlight(transport, detailKey(number), async (upstream) => {
    const result = await fetchPages((top, skip) => buildDisasterDetailUrl(number, top, skip), upstream, transport)
    if (result.records.some((record) => record.disasterNumber !== number)) {
      throw new FemaError('FEMA returned records for a different disaster. Please retry.')
    }
    return result
  }, signal)
}

export interface CacheEntry extends DisasterResult {
  query: DisasterQuery
  fetchedAt: number
}

import { syncGet, syncSet } from './disasterCache.ts'

export function setCachedDisasters(
  query: DisasterQuery,
  result: DisasterResult,
): void {
  syncSet(query, result, Date.now())
}

export function getCachedDisasters(): CacheEntry | null {
  return syncGet()
}

export function findCachedDisasters(
  query: DisasterQuery,
): DisasterRecord[] | null {
  const entry = syncGet()
  if (entry === null || !sameQuery(entry.query, query)) return null
  return entry.records
}

export function sameQuery(a: DisasterQuery, b: DisasterQuery): boolean {
  if (a.startYear !== b.startYear) return false
  if (a.endYear !== b.endYear) return false
  if (a.state !== b.state) return false
  if (a.incidentTypes.length !== b.incidentTypes.length) return false
  const left = [...a.incidentTypes].sort()
  const right = [...b.incidentTypes].sort()
  return left.every((type, index) => type === right[index])
}
