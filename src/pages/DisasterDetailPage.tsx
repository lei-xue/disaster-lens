import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.tsx'
import ErrorBanner from '../components/ErrorBanner.tsx'
import { DetailSkeleton } from '../components/Skeleton.tsx'
import { fetchDisasterDetail, parseDisasterNumber, type DisasterResult } from '../lib/fema.ts'
import { readDetailSnapshot, saveDetailSnapshot } from '../lib/disasterCache.ts'
import { formatDate } from '../lib/format.ts'

const TYPE_LABELS: Record<string, string> = {
  DR: 'Major disaster declaration',
  EM: 'Emergency declaration',
  FM: 'Fire management assistance',
}

export default function DisasterDetailPage() {
  const { disasterNumber } = useParams()
  const number = parseDisasterNumber(disasterNumber)
  const [attempt, setAttempt] = useState(0)
  const [forceRefresh, setForceRefresh] = useState(0)
  const [loaded, setLoaded] = useState<{
    number: number
    attempt: number
    result?: DisasterResult
    fetchedAt?: number
    fromCache?: boolean
    stale?: boolean
    error?: string
  } | null>(null)
  const loadedRef = useRef<typeof loaded>(null)
  const processedForceRef = useRef(0)

  useEffect(() => {
    if (number === null) return
    const force = forceRefresh !== processedForceRef.current
    processedForceRef.current = forceRefresh
    const priorFallback = loadedRef.current?.number === number ? loadedRef.current : null
    const controller = new AbortController()
    let cancelled = false
    const publish = (next: NonNullable<typeof loaded>) => {
      if (cancelled || controller.signal.aborted) return
      loadedRef.current = next
      setLoaded(next)
    }

    void (async () => {
      let fallback = priorFallback
      try {
        if (!force) {
          const snapshot = await readDetailSnapshot(number)
          if (cancelled || controller.signal.aborted) return
          if (snapshot) {
            fallback = {
              number, attempt, result: snapshot, fetchedAt: snapshot.fetchedAt,
              fromCache: true, stale: snapshot.stale,
            }
            publish(fallback)
            if (!snapshot.stale) return
          }
        }
        const result = await fetchDisasterDetail(number, controller.signal)
        if (cancelled || controller.signal.aborted) return
        const fetchedAt = Date.now()
        await saveDetailSnapshot(number, result, fetchedAt)
        if (cancelled || controller.signal.aborted) return
        publish({ number, attempt, result, fetchedAt, fromCache: false, stale: false })
      } catch (err) {
        if (cancelled || controller.signal.aborted) return
        const error = err instanceof Error ? err.message : 'Could not load details from FEMA.'
        if (fallback?.result) {
          publish({ ...fallback, number, attempt, stale: true, error })
        } else {
          publish({ number, attempt, error })
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [number, attempt, forceRefresh])

  const frame = (children: ReactNode) => (
    <div className="dl-page">
      <header>
        <Link to="/disasters" className="dl-link text-sm font-medium">← Back to loaded declarations</Link>
        <h1 className="dl-page-title mt-4">{number === null ? 'Declaration details' : `Disaster #${number}`}</h1>
      </header>
      {children}
    </div>
  )

  if (number === null) return frame(<EmptyState title="Invalid disaster number" hint="Use a positive whole-number FEMA disaster ID." />)
  const current = loaded?.number === number && loaded.attempt === attempt ? loaded : null
  if (current === null) {
    return frame(
      <div role="status" aria-label="Loading disaster details">
        <DetailSkeleton />
        <p className="sr-only">Loading disaster details from FEMA…</p>
      </div>
    )
  }
  if (current.error && !current.result) return frame(<ErrorBanner message={current.error} onRetry={() => { setForceRefresh((value) => value + 1); setAttempt((value) => value + 1) }} />)
  const result = current.result!
  const matches = result.records
  const primary = matches[0] ?? null
  const areas = [...new Set(matches.map((record) => record.designatedArea))]

  if (primary === null) {
    return frame(
      <EmptyState
        title={`No declaration found for disaster #${disasterNumber}`}
        hint="FEMA returned no records for this number. Try another declaration."
      >
        <button
          type="button"
          onClick={() => { setForceRefresh((value) => value + 1); setAttempt((value) => value + 1) }}
          className="dl-btn dl-btn-secondary"
        >
          Refresh details
        </button>
        <Link
          to="/disasters"
          className="dl-btn dl-btn-primary"
        >
          Back to explore
        </Link>
      </EmptyState>,
    )
  }

  return (
    <div className="dl-page">
      <header>
        <Link
          to="/disasters"
          className="dl-link text-sm font-medium"
        >
          ← Back to loaded declarations
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="dl-kicker">Declaration detail</p>
            <h1 className="dl-page-title mt-1">
              {primary.declarationTitle}
            </h1>
            <p className="dl-page-lede mt-2">
              FEMA disaster #{primary.disasterNumber} · {primary.state} · declared{' '}
              {formatDate(primary.declarationDate)}
            </p>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
            <span className="dl-chip max-w-full">
              {TYPE_LABELS[primary.declarationType] ?? primary.declarationType}
            </span>
            <span className="dl-chip max-w-full">
              {primary.incidentType}
            </span>
          </div>
        </div>
      </header>

      {result.limitReached ? (
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The 5,000-record loading limit was reached. The designated-area list below may be incomplete.
        </p>
      ) : null}
      {current.error && current.result ? <ErrorBanner message={current.error} onRetry={() => { setForceRefresh((value) => value + 1); setAttempt((value) => value + 1) }} /> : null}

      <article className="min-w-0 [overflow-wrap:anywhere]" aria-label="Declaration facts">
        <section className="dl-detail-facts">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <dt className="dl-kicker">Disaster number</dt>
              <dd className="mt-1 text-sm text-[var(--dl-ink)]">
                #{primary.disasterNumber}
              </dd>
            </div>
            <div>
              <dt className="dl-kicker">Declaration date</dt>
              <dd className="mt-1 text-sm text-[var(--dl-ink)]">
                {formatDate(primary.declarationDate)}
              </dd>
            </div>
            <div>
              <dt className="dl-kicker">State / Territory</dt>
              <dd className="mt-1 text-sm text-[var(--dl-ink)]">{primary.state}</dd>
            </div>
            <div>
              <dt className="dl-kicker">Incident type</dt>
              <dd className="mt-1 text-sm text-[var(--dl-ink)]">{primary.incidentType}</dd>
            </div>
          </dl>
        </section>
        <section className="dl-section" aria-label="Designated areas">
          <h2 className="dl-section-title">
            Loaded designated area{areas.length > 1 ? `s (${areas.length})` : ''}
          </h2>
          <div className="mt-3 text-sm text-[var(--dl-ink)]">
            {areas.length > 1 ? (
              <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                {areas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            ) : (
              areas[0]
            )}
          </div>
        </section>
        <p className="dl-note mt-6">
          Queried directly from OpenFEMA for disaster #{number}, independently of dashboard filters.
          This is declaration information, not a real-time hazard alert.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--dl-line)] pt-4">
          <button
            type="button"
            onClick={() => setForceRefresh((v) => v + 1)}
            className="dl-btn dl-btn-secondary"
          >
            Refresh details
          </button>
          {current.fetchedAt !== undefined ? (
            <span className="dl-meta">
              Fetched {new Date(current.fetchedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              {current.fromCache ? ' · cached' : ''}
              {current.stale ? ' · stale snapshot' : ''}
            </span>
          ) : null}
        </div>
      </article>
    </div>
  )
}
