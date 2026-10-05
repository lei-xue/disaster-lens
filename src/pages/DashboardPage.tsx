import { useCallback, useEffect, useRef, useState } from 'react'
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
import ChartCard from '../components/ChartCard.tsx'
import DataScope from '../components/DataScope.tsx'
import EmptyState from '../components/EmptyState.tsx'
import ErrorBanner from '../components/ErrorBanner.tsx'
import KpiCard from '../components/KpiCard.tsx'
import { DashboardSkeleton } from '../components/Skeleton.tsx'
import StateChoropleth from '../components/StateChoropleth.tsx'
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

type Status = 'loading' | 'success' | 'error'

const AXES_STYLE = { fontSize: 12, fill: '#64748b' } as const

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

  const selectMapState = (postal: string) => {
    const baseQuery = entry?.query ?? DEFAULT_QUERY
    const nextQuery = { ...baseQuery, incidentTypes: [...baseQuery.incidentTypes], state: postal }
    syncControls(nextQuery)
    startLoad(nextQuery, { syncDraft: true })
  }

  const years = yearOptions()
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          FEMA disaster declarations
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          County-level disaster declarations from {DATA_START_YEAR} to{' '}
          {CURRENT_YEAR}, straight from the OpenFEMA API. Filter, explore, and
          stay prepared.
        </p>
      </div>

      <section
        aria-label="Filters"
        className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <div>
            <label
              htmlFor="filter-from-year"
              className="block text-xs font-semibold text-slate-600 uppercase"
            >
              From year
            </label>
            <select
              id="filter-from-year"
              value={startYear}
              onChange={(event) => setStartYear(Number(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-to-year"
              className="block text-xs font-semibold text-slate-600 uppercase"
            >
              To year
            </label>
            <select
              id="filter-to-year"
              value={endYear}
              onChange={(event) => setEndYear(Number(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-state"
              className="block text-xs font-semibold text-slate-600 uppercase"
            >
              State
            </label>
            <select
              id="filter-state"
              value={stateCode}
              onChange={(event) => setStateCode(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <option value="">All states</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              aria-describedby={hasDraftChanges ? 'filters-changed-hint' : undefined}
              className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={refreshData}
              disabled={entry === null}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Refresh data
            </button>
            <button
              type="button"
              onClick={clearCachedData}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Clear cached data
            </button>
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-slate-600 uppercase">
            Incident types {selectedTypes.length === 0 ? '(all)' : ''}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {INCIDENT_TYPES.map((type) => {
              const active = selectedTypes.includes(type)
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(type)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                    active
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      {hasDraftChanges ? (
        <p id="filters-changed-hint" role="status" className="text-sm text-slate-600">
          Filters have changed. Apply them to update the loaded view.
        </p>
      ) : null}

      {status === 'error' ? (
        <>
          <ErrorBanner
            message={errorMessage}
            onRetry={() => startLoad(failedQueryRef.current ?? entry?.query ?? DEFAULT_QUERY, { force: true })}
          />
          {records !== null ? (
            <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Refresh failed for {failedScope}. Previous snapshot remains below.
            </p>
          ) : null}
        </>
      ) : null}

      {entry !== null ? (
        <p className="text-xs text-slate-500">
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
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Reset filters
          </button>
        </EmptyState>
      ) : null}

      {status === 'loading' && records !== null ? (
        <p role="status" className="text-sm text-slate-500">
          Updating data…
        </p>
      ) : null}

      {hasData ? (
        <div className="space-y-6">
          {entry ? <DataScope entry={entry} /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <KpiCard
              label="Declaration records"
              value={formatNumber(records.length)}
              hint="County-level declaration entries"
            />
            <KpiCard
              label="States affected"
              value={formatNumber(countStates(records))}
              hint="Distinct states and territories"
            />
            <KpiCard
              label="Most frequent incident"
              value={mostFrequentType(records) ?? '—'}
              hint="By record count in this view"
            />
            <KpiCard
              label="Busiest year"
              value={busiestYear(records)?.toString() ?? '—'}
              hint="Year with the most loaded records"
            />
          </div>

          <ChartCard
            title="Declaration records map"
            subtitle="County/area declaration records in the loaded snapshot (not unique disasters); select a state to filter or open the text table for values"
          >
            <StateChoropleth counts={allStateCounts} selectedState={appliedState} onSelectState={selectMapState} />
          </ChartCard>

          <ChartCard
            title="Declaration records by state"
            subtitle="Top 15 states and territories by county/area declaration records in the current view (not unique disasters)"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="state" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(30, 64, 175, 0.08)' }} />
                  <Bar dataKey="count" name="Declaration records" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {stateData.length > 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Highest: {stateData[0].state} with {formatNumber(stateData[0].count)}{' '}
                records in this view.
              </p>
            ) : null}
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <ChartCard
              title="Declaration records per year"
              subtitle="County/area declaration records per year in the current view (not unique disasters)"
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="year" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" name="Declaration records" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
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
            </ChartCard>

            <ChartCard
              title="Share by incident type"
              subtitle="Share of county/area declaration records by incident type in the current view (not unique disasters)"
            >
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
                      <span className="ml-auto shrink-0 text-slate-500">
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
            </ChartCard>
          </div>

          <p className="text-sm text-slate-600">
            Showing {formatNumber(records.length)} declaration records for{' '}
            {stateName} between {entry?.query.startYear} and {entry?.query.endYear}.{' '}
            <Link
              to="/disasters"
              className="font-semibold text-blue-700 hover:underline"
            >
              Browse loaded records →
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
