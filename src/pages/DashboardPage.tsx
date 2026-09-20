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
  MAX_RECORDS,
  setCachedDisasters,
  type DisasterQuery,
} from '../lib/fema.ts'
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

export default function DashboardPage() {
  const [startYear, setStartYear] = useState(DATA_START_YEAR)
  const [endYear, setEndYear] = useState(CURRENT_YEAR)
  const [stateCode, setStateCode] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [records, setRecords] = useState<DisasterRecord[] | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async (query: DisasterQuery) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const result = await fetchDisasters(query, controller.signal)
      if (controller.signal.aborted) return
      setCachedDisasters(query, result)
      setRecords(result)
      setStatus('success')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMessage(
        err instanceof FemaError
          ? err.message
          : 'Something went wrong while loading data from FEMA.',
      )
      setStatus('error')
    }
  }, [])

  const startLoad = (query: DisasterQuery) => {
    setStatus('loading')
    setErrorMessage('')
    void load(query)
  }

  useEffect(() => {
    void load({
      startYear: DATA_START_YEAR,
      endYear: CURRENT_YEAR,
      state: null,
      incidentTypes: [],
    })
    return () => controllerRef.current?.abort()
  }, [load])

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

  const years = yearOptions()
  const hasData = status !== 'error' && records !== null && records.length > 0
  const allStateCounts = hasData ? countByState(records) : []
  const stateData = allStateCounts.slice(0, 15)
  const yearData = hasData ? countByYear(records) : []
  const pieData = hasData ? pieDataFor(records) : []
  const stateName = stateCode === '' ? 'All states' : stateLabel(stateCode)

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
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
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
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
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <option value="">All states</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Reset
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
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
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

      {status === 'error' ? (
        <ErrorBanner message={errorMessage} onRetry={applyFilters} />
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              hint="Year with the most declarations"
            />
          </div>

          <ChartCard
            title="Declarations map"
            subtitle="Count per state in the current view; hover a state for details"
          >
            <StateChoropleth counts={allStateCounts} selectedState={stateCode} />
          </ChartCard>

          <ChartCard
            title="Declarations by state"
            subtitle="Top 15 states and territories in the current view"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="state" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(30, 64, 175, 0.08)' }} />
                  <Bar dataKey="count" name="Declarations" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Declarations per year">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="year" tick={AXES_STYLE} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tick={AXES_STYLE} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" name="Declarations" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Share by incident type">
              <div className="flex h-80 flex-col items-center gap-4 sm:flex-row">
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
                      <span className="truncate text-slate-700">{entry.type}</span>
                      <span className="ml-auto shrink-0 text-slate-500">
                        {formatNumber(entry.count)} · {formatShare(entry.share)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ChartCard>
          </div>

          <p className="text-sm text-slate-600">
            Showing {formatNumber(records.length)} declaration records for{' '}
            {stateName} between {startYear} and {endYear}.{' '}
            {records.length >= MAX_RECORDS && (
              <span className="font-medium text-amber-700">
                This view is capped at the most recent {formatNumber(MAX_RECORDS)} records —
                narrow the filters for complete coverage.{' '}
              </span>
            )}
            <Link
              to="/disasters"
              className="font-semibold text-blue-700 hover:underline"
            >
              Browse the full table →
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
