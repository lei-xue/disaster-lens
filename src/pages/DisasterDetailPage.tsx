import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.tsx'
import ErrorBanner from '../components/ErrorBanner.tsx'
import { DetailSkeleton } from '../components/Skeleton.tsx'
import { fetchDisasterDetail, parseDisasterNumber, type DisasterResult } from '../lib/fema.ts'
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
  const [loaded, setLoaded] = useState<{ number: number; attempt: number; result?: DisasterResult; error?: string } | null>(null)
  useEffect(() => {
    if (number === null) return
    const controller = new AbortController()
    void fetchDisasterDetail(number, controller.signal).then((result) => {
      if (!controller.signal.aborted) setLoaded({ number, attempt, result })
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setLoaded({ number, attempt, error: err instanceof Error ? err.message : 'Could not load details from FEMA.' })
    })
    return () => controller.abort()
  }, [number, attempt])

  if (number === null) return <EmptyState title="Invalid disaster number" hint="Use a positive whole-number FEMA disaster ID." />
  const current = loaded?.number === number && loaded.attempt === attempt ? loaded : null
  if (current === null) {
    return (
      <div role="status" aria-label="Loading disaster details">
        <DetailSkeleton />
        <p className="sr-only">Loading disaster details from FEMA…</p>
      </div>
    )
  }
  if (current.error) return <ErrorBanner message={current.error} onRetry={() => setAttempt((value) => value + 1)} />
  const result = current.result!
  const matches = result.records
  const primary = matches[0] ?? null
  const areas = [...new Set(matches.map((record) => record.designatedArea))]

  if (primary === null) {
    return (
      <EmptyState
        title={`No declaration found for disaster #${disasterNumber}`}
        hint="FEMA returned no records for this number. Try another declaration."
      >
        <Link
          to="/disasters"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Back to explore
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/disasters"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
      >
        ← Back to loaded declarations
      </Link>

      {result.limitReached ? (
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The 5,000-record loading limit was reached. The designated-area list below may be incomplete.
        </p>
      ) : null}
      <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 [overflow-wrap:anywhere] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {TYPE_LABELS[primary.declarationType] ?? primary.declarationType}
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {primary.incidentType}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          {primary.declarationTitle}
        </h1>
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Disaster number
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              #{primary.disasterNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Declaration date
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatDate(primary.declarationDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              State / Territory
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{primary.state}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Incident type
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{primary.incidentType}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Loaded designated area{areas.length > 1 ? `s (${areas.length})` : ''}
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {areas.length > 1 ? (
                <ul className="mt-1 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
                  {areas.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              ) : (
                areas[0]
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Queried directly from OpenFEMA for disaster #{number}, independently of dashboard filters.
          This is declaration information, not a real-time hazard alert.
        </p>
      </article>
    </div>
  )
}
