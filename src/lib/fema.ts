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

export function fetchDisasters(query: DisasterQuery, signal?: AbortSignal, request?: typeof fetch): Promise<DisasterResult> {
  return fetchPages((top, skip) => buildDisasterQueryUrl(query, top, skip), signal, request)
}

export async function fetchDisasterDetail(number: number, signal?: AbortSignal, request?: typeof fetch): Promise<DisasterResult> {
  const result = await fetchPages((top, skip) => buildDisasterDetailUrl(number, top, skip), signal, request)
  if (result.records.some((record) => record.disasterNumber !== number)) {
    throw new FemaError('FEMA returned records for a different disaster. Please retry.')
  }
  return result
}

export interface CacheEntry extends DisasterResult {
  query: DisasterQuery
  fetchedAt: number
}

let cache: CacheEntry | null = null

export function setCachedDisasters(
  query: DisasterQuery,
  result: DisasterResult,
): void {
  cache = {
    query: { ...query, incidentTypes: [...query.incidentTypes] },
    records: result.records,
    limitReached: result.limitReached,
    fetchedAt: Date.now(),
  }
}

export function getCachedDisasters(): CacheEntry | null {
  return cache
}

export function findCachedDisasters(
  query: DisasterQuery,
): DisasterRecord[] | null {
  if (cache === null || !sameQuery(cache.query, query)) return null
  return cache.records
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
