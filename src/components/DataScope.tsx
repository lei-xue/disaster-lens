import { MAX_RECORDS, type CacheEntry } from '../lib/fema.ts'
import { loadedDateRange } from '../lib/coverage.ts'

export default function DataScope({ entry }: { entry: CacheEntry }) {
  const { query } = entry
  const dates = loadedDateRange(entry.records)
  return (
    <div className="space-y-2 text-sm text-slate-600" aria-label="Loaded data scope">
      <p>
        Requested: {query.state || 'All states'} · {query.startYear}–{query.endYear} ·{' '}
        {query.incidentTypes.length ? query.incidentTypes.join(', ') : 'All incident types'}.
        {' '}Counts and search use loaded county / area declaration records, not unique disasters.
      </p>
      {dates ? <p>Loaded declaration dates: {dates.first}–{dates.last}.</p> : null}
      {entry.limitReached ? (
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 font-medium text-amber-900">
          Loading limit reached ({MAX_RECORDS.toLocaleString('en-US')} records). Statistics cover only this newest-first snapshot, not the full requested period. Narrow the year or state filters.
        </p>
      ) : null}
    </div>
  )
}
