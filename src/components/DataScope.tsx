import type { CacheEntry } from '../lib/fema.ts'

export default function DataScope({ entry }: { entry: CacheEntry }) {
  const { query } = entry
  return (
    <div className="space-y-2 text-sm text-slate-600" aria-label="Loaded data scope">
      <p>
        Loaded view: {query.state || 'All states'} · {query.startYear}–{query.endYear} ·{' '}
        {query.incidentTypes.length ? query.incidentTypes.join(', ') : 'All incident types'}.
        {' '}Counts and search use loaded county / area declaration records, not unique disasters.
      </p>
      {entry.limitReached ? (
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">
          The 5,000-record loading limit was reached. This view may be incomplete; narrow the dashboard filters for better coverage.
        </p>
      ) : null}
    </div>
  )
}
