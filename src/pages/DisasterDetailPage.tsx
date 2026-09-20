import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState.tsx'
import { getCachedDisasters } from '../lib/fema.ts'
import { formatDate } from '../lib/format.ts'

const TYPE_LABELS: Record<string, string> = {
  DR: 'Major disaster declaration',
  EM: 'Emergency declaration',
  FM: 'Fire management assistance',
}

export default function DisasterDetailPage() {
  const { disasterNumber } = useParams()
  const entry = getCachedDisasters()
  const number = Number(disasterNumber)
  const matches =
    entry?.records.filter((record) => record.disasterNumber === number) ?? []
  const primary = matches[0] ?? null
  const areas = [...new Set(matches.map((record) => record.designatedArea))]

  if (primary === null) {
    return (
      <EmptyState
        title={
          entry === null
            ? 'No declarations loaded yet'
            : `Disaster #${disasterNumber} is not in the loaded dataset`
        }
        hint={
          entry === null
            ? 'Load declarations from the dashboard or explore page, then return here.'
            : 'The dataset currently loaded may use filters that exclude this disaster.'
        }
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
        ← Back to all declarations
      </Link>

      <article className="rounded-lg border border-slate-200 bg-white p-6">
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
        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
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
              Designated area{areas.length > 1 ? `s (${areas.length})` : ''}
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {areas.length > 1 ? (
                <ul className="mt-1 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
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
          Details come from the FEMA Disaster Declarations Summaries dataset
          loaded in this browser session.
        </p>
      </article>
    </div>
  )
}
