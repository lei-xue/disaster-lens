// National Weather Service active alerts (api.weather.gov GeoJSON).
// Official endpoint: GET /alerts/active?area=XX&status=actual&message_type=alert,update
// No limit/pagination support exists on the endpoint — none is requested.

import { US_STATES } from './constants.ts'

export const NWS_BASE_URL = 'https://api.weather.gov'
export const MAX_RENDERED_ALERTS = 500
const DEFAULT_TIMEOUT_MS = 20_000

const VALID_AREAS = new Set(US_STATES.map((s) => s.code))

export interface AlertRecord {
  id: string
  sourceUrl: string | null
  event: string
  headline: string | null
  areaDesc: string | null
  senderName: string | null
  severity: string | null
  certainty: string | null
  urgency: string | null
  sent: string | null
  expires: string | null
  ends: string | null
  description: string | null
  instruction: string | null
}

export interface ActiveAlertsResult {
  records: AlertRecord[]
  totalReturned: number
  limitReached: boolean
}

export class NwsError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'NwsError'
    this.status = status
  }
}

function friendlyHttp(status: number): string {
  if (status === 429) return 'The National Weather Service is rate limiting requests. Please wait a moment and try again.'
  if (status === 400) return 'The National Weather Service rejected this request.'
  if (status === 404) return 'The National Weather Service could not find this resource.'
  if (status >= 500) return 'The National Weather Service service is unavailable right now. Please try again later.'
  return `The National Weather Service returned an unexpected response (HTTP ${status}).`
}

export function buildActiveAlertsUrl(area: string): string {
  if (!VALID_AREAS.has(area)) throw new NwsError(`Invalid state or territory code: ${area}`)
  const url = new URL(`${NWS_BASE_URL}/alerts/active`)
  url.searchParams.set('area', area)
  url.searchParams.set('status', 'actual')
  url.searchParams.set('message_type', 'alert,update')
  return url.toString()
}

export function isOfficialRecordUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.origin !== 'https://api.weather.gov') return false
  if (url.username || url.password) return false
  return url.pathname.startsWith('/alerts/')
}

function parseDateMs(value: string | null): number | null {
  if (value === null) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function getAlertEndMs(record: Pick<AlertRecord, 'ends' | 'expires'>): number | null {
  const candidates = [record.ends, record.expires]
    .map(parseDateMs)
    .filter((ms): ms is number => ms !== null)
  if (candidates.length === 0) return null
  return Math.min(...candidates)
}

function optString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function validateFeature(raw: unknown): AlertRecord | null {
  if (typeof raw !== 'object' || raw === null) throw new NwsError('The alert payload has an unexpected format.')
  const feature = raw as Record<string, unknown>
  const properties = feature.properties
  if (typeof properties !== 'object' || properties === null) throw new NwsError('The alert payload has an unexpected format.')
  const props = properties as Record<string, unknown>
  if (typeof props.event !== 'string' || typeof props.id !== 'string') {
    throw new NwsError('The alert payload has an unexpected format.')
  }
  if (props.event.length === 0 || props.id.length === 0) {
    throw new NwsError('The alert payload has an unexpected format.')
  }
  // Defensive filter: the query already restricts to Actual alert/update,
  // but never render cancellations, tests, or drills even if returned.
  if (props.status !== 'Actual') return null
  if (props.messageType !== 'Alert' && props.messageType !== 'Update') return null
  const featureId = optString(feature.id)
  const atId = props['@id']
  const sourceUrl = isOfficialRecordUrl(featureId) ? featureId : isOfficialRecordUrl(atId) ? atId : null
  return {
    id: props.id,
    sourceUrl,
    event: props.event,
    headline: optString(props.headline),
    areaDesc: optString(props.areaDesc),
    senderName: optString(props.senderName),
    severity: optString(props.severity),
    certainty: optString(props.certainty),
    urgency: optString(props.urgency),
    sent: optString(props.sent),
    expires: optString(props.expires),
    ends: optString(props.ends),
    description: optString(props.description),
    instruction: optString(props.instruction),
  }
}

export async function fetchActiveAlerts(
  area: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ActiveAlertsResult> {
  const url = buildActiveAlertsUrl(area)
  if (signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError')

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  // Cancellation promise that settles even when an injected request/json
  // ignores the AbortSignal entirely. Abort of the controller alone does not
  // reject such promises, so every await below is raced against this.
  const TIMEOUT_MESSAGE = 'The National Weather Service took too long to respond. Please try again.'
  const cancellation = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => {
      if (signal?.aborted) reject(new DOMException('This operation was aborted', 'AbortError'))
      else if (timedOut) reject(new NwsError(TIMEOUT_MESSAGE))
      else reject(new DOMException('This operation was aborted', 'AbortError'))
    }, { once: true })
  })
  // Avoid unhandled rejection if cancellation fires after resolution.
  cancellation.catch(() => {})

  try {
    let response: Response
    try {
      response = await Promise.race([
        request(url, {
          signal: controller.signal,
          headers: { Accept: 'application/geo+json' },
        }),
        cancellation,
      ])
    } catch (error) {
      if (signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError')
      if (timedOut) throw new NwsError(TIMEOUT_MESSAGE)
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new NwsError('Could not reach the National Weather Service. Check your connection and try again.')
    }

    let payload: unknown
    try {
      payload = await Promise.race([response.json(), cancellation])
    } catch (error) {
      if (signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError')
      if (timedOut) throw new NwsError(TIMEOUT_MESSAGE)
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (!response.ok) throw new NwsError(friendlyHttp(response.status), response.status)
      throw new NwsError('The National Weather Service response could not be read.')
    }

    if (signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError')
    if (timedOut) throw new NwsError(TIMEOUT_MESSAGE)

    if (!response.ok) throw new NwsError(friendlyHttp(response.status), response.status)
    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as { type?: unknown }).type !== 'FeatureCollection' ||
      !Array.isArray((payload as { features?: unknown }).features)
    ) {
      throw new NwsError('The alert payload has an unexpected format.')
    }

    const features = (payload as { features: unknown[] }).features
    const records: AlertRecord[] = []
    for (const raw of features) {
      const record = validateFeature(raw)
      if (record !== null) records.push(record)
    }

    const totalReturned = records.length
    records.sort((a, b) => {
      const aMs = parseDateMs(a.sent)
      const bMs = parseDateMs(b.sent)
      if (aMs === null && bMs === null) return 0
      if (aMs === null) return 1
      if (bMs === null) return -1
      return bMs - aMs
    })

    const limitReached = totalReturned > MAX_RENDERED_ALERTS
    return {
      records: limitReached ? records.slice(0, MAX_RENDERED_ALERTS) : records,
      totalReturned,
      limitReached,
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
