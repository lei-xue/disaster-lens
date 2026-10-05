import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { US_STATES } from '../lib/constants.ts'
import {
  fetchActiveAlerts,
  getAlertEndMs,
  NwsError,
  type ActiveAlertsResult,
  type AlertRecord,
} from '../lib/nws.ts'

const AUTO_REFRESH_MS = 5 * 60 * 1000
const EXPIRY_TICK_MS = 60 * 1000

interface Snapshot {
  area: string
  result: ActiveAlertsResult
  fetchedAt: number
}

function stateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code
}

// Explicit UTC timezone in every rendered timestamp.
function formatUtc(ms: number): string {
  return `${new Date(ms).toISOString().replace('T', ' ').slice(0, 16)} UTC`
}

function formatTimestamp(value: string | null): string {
  if (value === null) return 'Unknown'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return 'Unknown'
  return formatUtc(ms)
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="min-w-0 text-sm leading-snug text-[var(--dl-ink-soft)] [overflow-wrap:anywhere]">
      <span className="font-semibold text-[var(--dl-ink)]">{label}: </span>
      {value ?? 'Not provided'}
    </p>
  )
}

function AlertCard({ record, nowMs }: { record: AlertRecord; nowMs: number }) {
  const endMs = getAlertEndMs(record)
  const expired = endMs !== null && endMs <= nowMs
  return (
    <li className="dl-card min-w-0 border-l-4 border-l-[var(--dl-teal)]">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-[var(--dl-navy-deep)] [overflow-wrap:anywhere]">
            {record.event}
          </h3>
          {record.headline !== null ? (
            <p className="mt-1 text-sm leading-snug text-[var(--dl-ink-soft)] [overflow-wrap:anywhere]">
              {record.headline}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-[var(--dl-line)] bg-[var(--dl-paper)] px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--dl-teal)] [overflow-wrap:anywhere]">
          {record.severity ?? 'Severity unknown'}
        </span>
      </div>

      {expired ? (
        <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Expired since retrieval — not a current warning.
        </p>
      ) : null}

      <div className="mt-3 grid min-w-0 gap-x-6 gap-y-1.5 border-t border-[var(--dl-line)] pt-3 sm:grid-cols-2 [overflow-wrap:anywhere]">
        <Field label="Area" value={record.areaDesc} />
        <Field label="Sender" value={record.senderName} />
        <Field label="Severity" value={record.severity} />
        <Field label="Urgency" value={record.urgency} />
        <Field label="Certainty" value={record.certainty} />
        <p className="text-sm leading-snug text-[var(--dl-ink-soft)]">
          <span className="font-semibold text-[var(--dl-ink)]">Sent: </span>
          {formatTimestamp(record.sent)}
        </p>
        <p className="text-sm leading-snug text-[var(--dl-ink-soft)]">
          <span className="font-semibold text-[var(--dl-ink)]">Expires: </span>
          {formatTimestamp(record.expires)}
        </p>
        <p className="text-sm leading-snug text-[var(--dl-ink-soft)]">
          <span className="font-semibold text-[var(--dl-ink)]">Ends: </span>
          {formatTimestamp(record.ends)}
        </p>
        <p className="text-sm leading-snug text-[var(--dl-ink-soft)]">
          <span className="font-semibold text-[var(--dl-ink)]">End of validity: </span>
          {endMs === null ? 'Unknown' : formatUtc(endMs)}
        </p>
      </div>

      <details className="group mt-3 border-t border-[var(--dl-line)] pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[var(--dl-ink)] marker:hidden hover:text-[var(--dl-teal)] [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="mr-1.5 inline-block text-[var(--dl-teal)] transition-transform motion-reduce:transition-none group-open:rotate-90"
          >
            ▸
          </span>
          Description and instructions
        </summary>
        <div className="mt-2 space-y-3 pl-5">
          <div>
            <p className="text-sm font-semibold text-[var(--dl-ink)]">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--dl-ink-soft)] [overflow-wrap:anywhere]">
              {record.description ?? 'Not provided'}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--dl-ink)]">Instruction</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--dl-ink-soft)] [overflow-wrap:anywhere]">
              {record.instruction ?? 'Not provided'}
            </p>
          </div>
        </div>
      </details>

      {record.sourceUrl !== null ? (
        <p className="mt-3 border-t border-[var(--dl-line)] pt-2">
          <a
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--dl-navy)] underline decoration-[var(--dl-teal)] underline-offset-4 hover:text-[var(--dl-teal)] [overflow-wrap:anywhere]"
            href={record.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Official NWS record (JSON)
          </a>
        </p>
      ) : null}
    </li>
  )
}

export default function AlertsPage() {
  const [draftArea, setDraftArea] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [appliedArea, setAppliedArea] = useState<string | null>(null)
  const [pendingArea, setPendingArea] = useState<string | null>(null)
  const [error, setError] = useState<{ area: string; message: string } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [paused, setPaused] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const requestSeq = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  const autoRefreshRef = useRef(false)
  const autoRefreshAreaRef = useRef<string | null>(null)

  const load = useCallback((area: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    inFlightRef.current = true
    const seq = ++requestSeq.current
    setPendingArea(area)
    setError(null)
    fetchActiveAlerts(area, controller.signal)
      .then((result) => {
        if (seq !== requestSeq.current) return
        inFlightRef.current = false
        setNowMs(Date.now())
        setSnapshot({ area, result, fetchedAt: Date.now() })
        setAppliedArea(area)
        setPendingArea(null)
      })
      .catch((err: unknown) => {
        if (seq !== requestSeq.current) return
        inFlightRef.current = false
        setPendingArea(null)
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message =
          err instanceof NwsError || err instanceof Error
            ? err.message
            : 'The request failed. Please try again.'
        setError({ area, message })
      })
  }, [])

  // Abort any in-flight request when the page unmounts.
  useEffect(() => {
    return () => {
      requestSeq.current += 1
      abortRef.current?.abort()
    }
  }, [])

  // Minute timer to keep local "expired" labels accurate while the page is open.
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), EXPIRY_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Auto-refresh: fixed 5-minute interval, only while visible, never during an
  // active request. Pauses when hidden; on becoming visible it restarts a full
  // 5-minute interval without firing immediately.
  useEffect(() => {
    autoRefreshRef.current = autoRefresh
    autoRefreshAreaRef.current = appliedArea
    if (!autoRefresh || appliedArea === null) {
      setPaused(false)
      return
    }
    setPaused(document.visibilityState !== 'visible')
    let interval: number | null = null
    const start = () => {
      if (interval !== null || document.visibilityState !== 'visible') return
      setPaused(false)
      interval = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        if (inFlightRef.current) return // never overlap an active request
        const area = autoRefreshAreaRef.current
        if (autoRefreshRef.current && area !== null) load(area)
      }, AUTO_REFRESH_MS)
    }
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval)
        interval = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        start() // restarts the full interval; never fires immediately
      } else {
        setPaused(true)
        stop()
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [autoRefresh, appliedArea, load])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (draftArea === '') return
    load(draftArea)
  }

  const isLoading = pendingArea !== null
  const isRefreshing = isLoading && snapshot !== null
  const draftDiffers =
    snapshot !== null && draftArea !== '' && draftArea !== snapshot.area

  return (
    <div className="dl-page">
      <header>
        <p className="dl-kicker">Live source · api.weather.gov</p>
        <h1 className="dl-page-title mt-1 [overflow-wrap:anywhere]">
          Current weather alerts
        </h1>
        <p className="dl-page-lede">
          Active alerts published by the U.S. National Weather Service for a
          state or territory you choose. Nothing is loaded until you ask.
        </p>
      </header>

      <form onSubmit={onSubmit} className="dl-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1">
            <label
              htmlFor="alerts-area"
              className="block text-sm font-semibold text-[var(--dl-ink)]"
            >
              State or territory
            </label>
            <select
              id="alerts-area"
              value={draftArea}
              onChange={(event) => setDraftArea(event.target.value)}
              className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-[var(--dl-line)] bg-[var(--dl-surface)] px-3 py-2 text-base text-[var(--dl-ink)] focus:border-[var(--dl-navy)] focus:outline-none"
            >
              <option value="">Select a state or territory…</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={draftArea === ''}
            className="min-h-11 rounded-md bg-[var(--dl-navy)] px-4 py-2 text-sm font-semibold text-[var(--dl-surface)] hover:bg-[var(--dl-navy-deep)] disabled:cursor-not-allowed disabled:bg-[var(--dl-line)] disabled:text-[var(--dl-ink-soft)]"
          >
            Load alerts
          </button>
          {snapshot !== null ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => load(snapshot.area)}
              className="min-h-11 rounded-md border border-[var(--dl-navy)] bg-[var(--dl-surface)] px-4 py-2 text-sm font-semibold text-[var(--dl-navy)] hover:bg-[var(--dl-paper)] disabled:cursor-not-allowed disabled:border-[var(--dl-line)] disabled:text-[var(--dl-ink-soft)]"
            >
              Refresh alerts
            </button>
          ) : null}
        </div>
        <p className="mt-3 border-t border-[var(--dl-line)] pt-3 text-sm leading-relaxed text-[var(--dl-ink-soft)]">
          Loads current alerts directly from the U.S. National Weather Service
          (api.weather.gov). The query includes your selected state/territory;
          NWS also receives normal connection information such as your IP
          address and browser headers. We do not request device location. Data
          may be delayed or cached; this covers official NWS weather alerts
          only, not all hazards, and it is not a guaranteed real-time warning
          or notification service — there is no push or live monitoring.
          Always follow local officials.
        </p>
      </form>

      {snapshot !== null ? (
        <section aria-label="Loaded alerts" className="dl-card">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--dl-line)] pb-3">
            <h2 className="text-base font-bold text-[var(--dl-navy-deep)]">
              Alerts for {stateName(snapshot.area)} ({snapshot.area}) — fetched{' '}
              {formatUtc(snapshot.fetchedAt)}
            </h2>
            {isRefreshing ? (
              <p
                role="status"
                className="rounded-full bg-[var(--dl-teal)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--dl-surface)]"
              >
                Updating…
              </p>
            ) : null}
            {error !== null && !isLoading ? (
              <p
                role="alert"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900"
              >
                Stale — last updated {formatUtc(snapshot.fetchedAt)}; refresh
                for {stateName(error.area)} ({error.area}) failed: {error.message}
              </p>
            ) : null}
          </div>

          {draftDiffers ? (
            <p className="mt-2 text-sm text-[var(--dl-ink-soft)]">
              Showing results for {stateName(snapshot.area)} ({snapshot.area});
              selection changed to {stateName(draftArea)} ({draftArea}) — press
              “Load alerts” to apply.
            </p>
          ) : null}

          {snapshot.result.limitReached ? (
            <p
              role="status"
              className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
            >
              Showing {snapshot.result.records.length} of{' '}
              {snapshot.result.totalReturned} alerts returned by NWS for this
              snapshot.
            </p>
          ) : null}

          <p className="mt-2 text-sm text-[var(--dl-ink-soft)]">
            {snapshot.result.records.length}{' '}
            {snapshot.result.records.length === 1 ? 'alert' : 'alerts'} in the
            snapshot fetched at {formatUtc(snapshot.fetchedAt)} — a record
            count at that moment, not a guarantee of currently active alerts.
          </p>

          {snapshot.result.records.length === 0 ? (
            <p className="mt-3 rounded-md border border-[var(--dl-line)] bg-[var(--dl-paper)] p-4 text-sm text-[var(--dl-ink-soft)]">
              No active alerts were returned by NWS for{' '}
              {stateName(snapshot.area)} ({snapshot.area}) in this snapshot.
              This does not mean there is no danger — always follow local
              officials.
            </p>
          ) : (
            <ul className="mt-3 grid gap-4">
              {snapshot.result.records.map((record) => (
                <AlertCard key={record.id} record={record} nowMs={nowMs} />
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-md border border-[var(--dl-line)] bg-[var(--dl-paper)] p-4">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--dl-ink)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-5 w-5 accent-[var(--dl-navy)]"
              />
              Auto-refresh every 5 minutes
            </label>
            <p className="mt-1 text-sm text-[var(--dl-ink-soft)]">
              Status:{' '}
              {autoRefresh
                ? paused
                  ? 'On — paused while this tab is hidden'
                  : 'On — refreshes every 5 minutes while this tab is visible'
                : 'Off'}
            </p>
          </div>
        </section>
      ) : null}

      {isLoading && snapshot === null && pendingArea !== null ? (
        <p role="status" className="dl-card text-sm font-medium text-[var(--dl-navy)]">
          Loading current alerts for {stateName(pendingArea)} ({pendingArea})…
        </p>
      ) : null}

      {error !== null && snapshot === null && !isLoading ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-medium">
            Could not load alerts for {stateName(error.area)} ({error.area}):{' '}
            {error.message}
          </p>
          <button
            type="button"
            onClick={() => load(error.area)}
            className="mt-3 min-h-11 rounded-md bg-[var(--dl-navy)] px-4 py-2 text-sm font-semibold text-[var(--dl-surface)] hover:bg-[var(--dl-navy-deep)]"
          >
            Retry for {stateName(error.area)} ({error.area})
          </button>
        </div>
      ) : null}
    </div>
  )
}
