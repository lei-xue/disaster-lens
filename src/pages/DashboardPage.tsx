import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DataScope from '../components/DataScope.tsx'
import EmptyState from '../components/EmptyState.tsx'
import ErrorBanner from '../components/ErrorBanner.tsx'
import { DashboardSkeleton } from '../components/Skeleton.tsx'
import MapBoundary from '../components/MapBoundary.tsx'
import {
  busiestYear,
  countByState,
  countByYear,
  countStates,
  mostFrequentType,
  shareByType,
} from '../lib/aggregate.ts'
import {
  CHART_COLORS,
  CURRENT_YEAR,
  DATA_START_YEAR,
  INCIDENT_TYPES,
  US_STATES,
} from '../lib/constants.ts'
import {
  fetchDisasters,
  FemaError,
  sameQuery,
  setCachedDisasters,
  type CacheEntry,
  type DisasterQuery,
} from '../lib/fema.ts'
import {
  clearCache,
  markQueryApplied,
  readLastAppliedSnapshot,
  readQuerySnapshot,
  saveQuerySnapshot,
  syncSet,
  type QuerySnapshot,
} from '../lib/disasterCache.ts'
import { formatNumber, formatShare } from '../lib/format.ts'
import type { DisasterRecord } from '../lib/types.ts'

const StateChoropleth = lazy(() => import('../components/StateChoropleth.tsx'))

type Status = 'loading' | 'success' | 'error'

const AXES_STYLE = { fontSize: 12, fill: '#4b5563' } as const

function yearOptions(): number[] {
  const years: number[] = []
  for (let year = CURRENT_YEAR; year >= DATA_START_YEAR; year--) {
    years.push(year)
  }
  return years
}

function stateLabel(code: string): string {
  const option = US_STATES.find((state) => state.code === code)
  return option ? option.name : code
}

function pieDataFor(records: DisasterRecord[]) {
  const shares = shareByType(records)
  if (shares.length <= 8) return shares
  const top = shares.slice(0, 7)
  const restCount = shares
    .slice(7)
    .reduce((sum, entry) => sum + entry.count, 0)
  return [
    ...top,
    { type: 'All other types', count: restCount, share: restCount / records.length },
  ]
}

function toEntry(snapshot: QuerySnapshot): CacheEntry {
  return {
    query: snapshot.query,
    records: snapshot.records,
    limitReached: snapshot.limitReached,
    fetchedAt: snapshot.fetchedAt,
  }
}

function formatFetchedAt(fetchedAt: number): string {
  return `${new Date(fetchedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC`
}

const DEFAULT_QUERY: DisasterQuery = {
  startYear: DATA_START_YEAR,
  endYear: CURRENT_YEAR,
  state: null,
  incidentTypes: [],
}

export default function DashboardPage() {
  const [startYear, setStartYear] = useState(DATA_START_YEAR)
  const [endYear, setEndYear] = useState(CURRENT_YEAR)
  const [stateCode, setStateCode] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [entry, setEntry] = useState<CacheEntry | null>(null)
  const records = entry?.records ?? null
  const [status, setStatus] = useState<Status>('loading')
  const [isStale, setIsStale] = useState(false)
  const [isDurable, setIsDurable] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [failedScope, setFailedScope] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  const tokenRef = useRef(0)
  const failedQueryRef = useRef<DisasterQuery | null>(null)
  const filterDetailsRef = useRef<HTMLDetailsElement | null>(null)

  const syncControls = useCallback((query: DisasterQuery) => {
    setStartYear(query.startYear)
    setEndYear(query.endYear)
    setStateCode(query.state ?? '')
    setSelectedTypes([...query.incidentTypes])
  }, [])

  const applySnapshot = useCallback(
    (token: number, snapshot: QuerySnapshot) => {
      if (tokenRef.current !== token) return false
      const cacheEntry = toEntry(snapshot)
      syncSet(cacheEntry.query, snapshot, snapshot.fetchedAt)
      setEntry(cacheEntry)
      setIsStale(snapshot.stale)
      setIsDurable(snapshot.durable)
      setStatus('success')
      setErrorMessage('')
      setFailedScope('')
      return true
    },
    [],
  )

  const load = useCallback(
    async (query: DisasterQuery, options: { force?: boolean; syncDraft?: boolean } = {}) => {
      const token = ++tokenRef.current
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        if (!options.force) {
          const snapshot = await readQuerySnapshot(query)
          if (tokenRef.current !== token || controller.signal.aborted) return
          if (snapshot !== null && !snapshot.stale) {
            const marked = await markQueryApplied(query)
            if (tokenRef.current !== token || controller.signal.aborted) return
            applySnapshot(token, { ...snapshot, durable: snapshot.durable && marked })
            if (options.syncDraft) syncControls(query)
            return
          }
        }
        const result = await fetchDisasters(query, controller.signal)
        if (controller.signal.aborted || tokenRef.current !== token) return
        const fetchedAt = Date.now()
        setCachedDisasters(query, result)
        syncSet({ ...query, incidentTypes: [...query.incidentTypes] }, result, fetchedAt)
        const saved = await saveQuerySnapshot(query, result, fetchedAt)
        if (tokenRef.current !== token) return
        setEntry({
          ...result,
          query: { ...query, incidentTypes: [...query.incidentTypes] },
          fetchedAt,
        })
        setIsStale(false)
        setIsDurable(saved)
        setStatus('success')
        setErrorMessage('')
        setFailedScope('')
        if (options.syncDraft) syncControls(query)
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
        if (tokenRef.current !== token) return
        setIsStale(true)
        setErrorMessage(
          err instanceof FemaError
            ? err.message
            : 'Something went wrong while loading data from FEMA.',
        )
        failedQueryRef.current = { ...query, incidentTypes: [...query.incidentTypes] }
        setFailedScope(
          `${query.state || 'All states'} · ${query.startYear}–${query.endYear} · ${
            query.incidentTypes.length ? query.incidentTypes.join(', ') : 'All incident types'
          }`,
        )
        setStatus('error')
      }
    },
    [applySnapshot, syncControls],
  )

  const startLoad = (query: DisasterQuery, options?: { force?: boolean; syncDraft?: boolean }) => {
    setStatus('loading')
    setErrorMessage('')
    void load(query, options)
  }

  useEffect(() => {
    let cancelled = false
    const token = ++tokenRef.current
    const restore = async () => {
      const last = await readLastAppliedSnapshot()
      if (cancelled || tokenRef.current !== token) return
      if (last !== null) {
        const applied = applySnapshot(token, last)
        syncControls(last.query)
        if (applied && !last.stale) return
      }
      setStatus('loading')
      void load(last?.query ?? DEFAULT_QUERY, { syncDraft: true })
    }
    void restore()
    return () => {
      cancelled = true
      tokenRef.current += 1
      controllerRef.current?.abort()
    }
  }, [applySnapshot, load, syncControls])

  const applyFilters = () => {
    const from = Math.min(startYear, endYear)
    const to = Math.max(startYear, endYear)
    setStartYear(from)
    setEndYear(to)
    startLoad({
      startYear: from,
      endYear: to,
      state: stateCode === '' ? null : stateCode,
      incidentTypes: selectedTypes,
    })
  }

  const resetFilters = () => {
    setStartYear(DATA_START_YEAR)
    setEndYear(CURRENT_YEAR)
    setStateCode('')
    setSelectedTypes([])
    startLoad({
      startYear: DATA_START_YEAR,
      endYear: CURRENT_YEAR,
      state: null,
      incidentTypes: [],
    })
  }

  const toggleType = (type: string) => {
    setSelectedTypes((previous) =>
      previous.includes(type)
        ? previous.filter((item) => item !== type)
        : [...previous, type],
    )
  }

  const refreshData = () => {
    if (entry !== null) startLoad(entry.query, { force: true })
  }

  const clearCachedData = () => {
    const token = ++tokenRef.current
    controllerRef.current?.abort()
    const hadEntry = entry !== null
    void clearCache()
      .then(() => {
        if (tokenRef.current !== token) return
        setIsDurable(false)
        if (hadEntry) {
          setStatus('success')
          setErrorMessage('')
          setFailedScope('')
        } else {
          setStatus('error')
          setErrorMessage('No cached data remains. Run a query to load fresh results.')
        }
      })
      .catch(() => {
        if (tokenRef.current !== token) return
        setStatus(hadEntry ? 'success' : 'error')
      })
  }

  const selectStateScope = (postal: string) => {
    // State scope changes immediately from either the map or the State
    // dropdown, but the request reuses only the currently applied year/type
    // filters. Pending year/type drafts stay untouched until Apply filters.
    // An empty code means the nationwide scope (state: null). The applied
    // snapshot keeps its own query until this exact request succeeds, so a
    // stale response can never relabel old data (token guard in load).
    const baseQuery = entry?.query ?? DEFAULT_QUERY
    const nextQuery = {
      ...baseQuery,
      incidentTypes: [...baseQuery.incidentTypes],
      state: postal === '' ? null : postal,
    }
    setStateCode(postal)
    startLoad(nextQuery)
  }

  const years = yearOptions()
  // Preserve exact source values, including types introduced by FEMA later.
  const incidentTypes = [...new Set([
    ...INCIDENT_TYPES,
    ...(records ?? []).map((record) => record.incidentType),
    ...selectedTypes,
  ])].filter(Boolean).sort()
  const hasData = records !== null && records.length > 0
  const allStateCounts = hasData ? countByState(records) : []
  const stateData = allStateCounts.slice(0, 15)
  const yearData = hasData ? countByYear(records) : []
  const pieData = hasData ? pieDataFor(records) : []
  const appliedState = entry?.query.state || ''
  const stateName = appliedState === '' ? 'All states' : stateLabel(appliedState)
  const hasDraftChanges = entry !== null && !sameQuery(entry.query, {
    startYear, endYear, state: stateCode || null, incidentTypes: selectedTypes,
  })

  // Keep the native <details> filter genuinely open on desktop and genuinely
  // closed on mobile by syncing the open attribute with the viewport. Runs
  // after hasData-dependent mount switches (fallback vs workspace) so the ref
  // is attached to whichever details instance is rendered. CSS never
  // force-displays a closed details body; the summary stays visible and
  // keyboard-toggleable at every width.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const sync = () => {
      if (filterDetailsRef.current) filterDetailsRef.current.open = media.matches
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [hasData])

  // Single filter control instance (ids stay unique across layouts): the
  // state selector applies immediately; year/type are drafts committed by
  // Apply filters. The <details> wrapper is a native collapsible on every
  // screen — open by default on desktop via the effect above, collapsed on
  // mobile so the map stays first.
  const stateSelector = (
    <div>
      <label htmlFor="filter-state" className="dl-field-label">
        State
      </label>
      <select
        id="filter-state"
        value={stateCode}
        onChange={(event) => selectStateScope(event.target.value)}
        className="dl-select"
      >
        <option value="">All states</option>
        {US_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>
    </div>
  )

  const filterDetailsBody = (
    <div className="dl-filter-body">
      <div>
        <label htmlFor="filter-from-year" className="dl-field-label">
          From year
        </label>
        <select
          id="filter-from-year"
          value={startYear}
          onChange={(event) => setStartYear(Number(event.target.value))}
          className="dl-select"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filter-to-year" className="dl-field-label">
          To year
        </label>
        <select
          id="filter-to-year"
          value={endYear}
          onChange={(event) => setEndYear(Number(event.target.value))}
          className="dl-select"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="dl-field-label">
          Incident types {selectedTypes.length === 0 ? '(all)' : ''}
        </legend>
        <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto" tabIndex={0} aria-label="Incident type options">
          {incidentTypes.map((type) => {
            const active = selectedTypes.includes(type)
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => toggleType(type)}
                className="dl-chip"
              >
                {type}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyFilters}
          aria-describedby={hasDraftChanges ? 'filters-changed-hint' : undefined}
          className="dl-btn dl-btn-primary"
        >
          Apply filters
        </button>
        <button
          type="button"
          onClick={resetFilters}
          className="dl-btn dl-btn-secondary"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={refreshData}
          disabled={entry === null}
          className="dl-btn dl-btn-secondary dl-btn-compact"
        >
          Refresh data
        </button>
        <button
          type="button"
          onClick={clearCachedData}
          className="dl-btn dl-btn-secondary dl-btn-compact"
        >
          Clear cached data
        </button>
      </div>
      {hasDraftChanges ? (
        <p id="filters-changed-hint" role="status" className="dl-meta">
          Filters have changed. Apply them to update the loaded view.
        </p>
      ) : null}
    </div>
  )

  const filtersPanel = (
    <section aria-label="Filters" className="dl-filter-rail">
      {stateSelector}
      <details className="dl-filter-details" ref={filterDetailsRef}>
        <summary className="dl-filter-summary">Year and incident type filters</summary>
        {filterDetailsBody}
      </details>
    </section>
  )

  return (
    <div className="dl-page dl-dashboard">
      <div>
        <h1 className="dl-page-title">
          FEMA disaster declarations
        </h1>

      </div>

      {status === 'error' ? (
        <>
          <ErrorBanner
            message={errorMessage}
            onRetry={() => startLoad(failedQueryRef.current ?? entry?.query ?? DEFAULT_QUERY, { force: true })}
          />
          {records !== null ? (
            <p role="note" className="dl-note">
              Refresh failed for {failedScope}. Previous snapshot remains below.
            </p>
          ) : null}
        </>
      ) : null}

      {entry !== null ? (
        <p className="dl-meta">
          Fetched {formatFetchedAt(entry.fetchedAt)} ·{' '}
          {isStale ? 'stale snapshot; update needed' : 'fresh'} ·{' '}
          {isDurable ? 'cached' : 'currently loaded, not persisted'}
        </p>
      ) : null}

      {status === 'loading' && records === null ? <DashboardSkeleton /> : null}

      {records !== null && records.length === 0 && status === 'success' ? (
        <EmptyState
          title="No declarations match these filters"
          hint="Try widening the year range or clearing the state and incident type filters."
        >
          <button
            type="button"
            onClick={resetFilters}
            className="dl-btn dl-btn-primary"
          >
            Reset filters
          </button>
        </EmptyState>
      ) : null}

      {status === 'loading' && records !== null ? (
        <p role="status" className="dl-meta">
          Updating data…
        </p>
      ) : null}

      {!hasData ? (
        <div className="dl-card">{filtersPanel}</div>
      ) : null}

      {hasData ? (
        <div className="dl-page">
          <div className="dl-workspace">
            {filtersPanel}
            <div className="dl-workspace-main">
              <section aria-labelledby="map-title" className="dl-map-section">
                <h2 id="map-title" className="dl-section-title">
                  Declaration records map
                </h2>
                {entry ? <DataScope entry={entry} /> : null}
                <p className="dl-meta">
                  Select a state to filter.
                </p>
                <MapBoundary>
                  <Suspense fallback={<p role="status" className="dl-meta">Loading map…</p>}>
                    <StateChoropleth counts={allStateCounts} selectedState={appliedState} onSelectState={selectStateScope} />
                  </Suspense>
                </MapBoundary>
              </section>
              <dl className="dl-stat-band">
                <div className="dl-stat">
                  <dt>Declaration records</dt>
                  <dd>{formatNumber(records.length)}</dd>
                  <dd className="dl-stat-hint">County-level declaration entries</dd>
                </div>
                <div className="dl-stat">
                  <dt>States affected</dt>
                  <dd>{formatNumber(countStates(records))}</dd>
                  <dd className="dl-stat-hint">Distinct states and territories</dd>
                </div>
                <div className="dl-stat">
                  <dt>Most frequent incident</dt>
                  <dd>{mostFrequentType(records) ?? '—'}</dd>
                  <dd className="dl-stat-hint">By record count in this view</dd>
                </div>
                <div className="dl-stat">
                  <dt>Busiest year</dt>
                  <dd>{busiestYear(records)?.toString() ?? '—'}</dd>
                  <dd className="dl-stat-hint">Year with the most loaded records</dd>
                </div>
              </dl>
            </div>
          </div>

          <section aria-labelledby="state-chart-title" className="dl-section">
            <h2 id="state-chart-title" className="dl-section-title">
              Declaration records by state
            </h2>
            <p className="dl-meta">
              Top 15 states and territories in the loaded view.
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
                  <XAxis dataKey="state" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#c3cad2' }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(32, 36, 43, 0.06)' }} />
                  <Bar dataKey="count" name="Declaration records" fill="#c2410c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {stateData.length > 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Highest: {stateData[0].state} with {formatNumber(stateData[0].count)}{' '}
                records in this view.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="year-chart-title" className="dl-section">
            <h2 id="year-chart-title" className="dl-section-title">
              Declaration records per year
            </h2>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d8dde3" vertical={false} />
                  <XAxis dataKey="year" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#c3cad2' }} />
                  <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Declaration records" stroke="#9a3412" strokeWidth={2} dot={{ r: 3, fill: '#c2410c' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                Declaration records per year (text table, {yearData.length}{' '}
                {yearData.length === 1 ? 'year' : 'years'})
              </summary>
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                    <th scope="col" className="py-1 pr-4 font-semibold">Year</th>
                    <th scope="col" className="py-1 font-semibold">Declaration records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearData.map((item) => (
                    <tr key={item.year}>
                      <td className="py-1 pr-4 text-slate-700">{item.year}</td>
                      <td className="py-1 text-slate-700">{formatNumber(item.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            {yearData.length > 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Busiest year:{' '}
                {yearData.reduce((top, item) => (item.count > top.count ? item : top), yearData[0]).year}{' '}
                with{' '}
                {formatNumber(yearData.reduce((top, item) => (item.count > top.count ? item : top), yearData[0]).count)}{' '}
                records in this view.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="type-chart-title" className="dl-section">
            <h2 id="type-chart-title" className="dl-section-title">
              Share by incident type
            </h2>

            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-64 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="type"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={1}
                      strokeWidth={1}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`${entry.type}-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
                {pieData.map((entry, index) => (
                  <li
                    key={`${entry.type}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="min-w-0 text-slate-700">{entry.type}</span>
                    <span className="ml-auto shrink-0 text-slate-600">
                      {formatNumber(entry.count)} · {formatShare(entry.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {pieData.length > 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Most common type: {pieData[0].type} with {formatNumber(pieData[0].count)}{' '}
                records ({formatShare(pieData[0].share)}) in this view.
              </p>
            ) : null}
          </section>

          <p className="text-sm text-slate-600">
            Showing {formatNumber(records.length)} declaration records for{' '}
            {stateName} between {entry?.query.startYear} and {entry?.query.endYear}.{' '}
            <Link to="/disasters" className="dl-link">
              Browse loaded records →
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
