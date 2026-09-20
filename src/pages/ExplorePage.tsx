import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState.tsx'
import ErrorBanner from '../components/ErrorBanner.tsx'
import { TableSkeleton } from '../components/Skeleton.tsx'
import { CURRENT_YEAR, DATA_START_YEAR } from '../lib/constants.ts'
import {
  fetchDisasters,
  FemaError,
  getCachedDisasters,
  setCachedDisasters,
  type CacheEntry,
  type DisasterQuery,
} from '../lib/fema.ts'
import { formatDate, formatNumber } from '../lib/format.ts'
import { paginate, searchRecords, sortRecords, type SortKey } from '../lib/tableUtils.ts'

const PAGE_SIZE = 25

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'declarationTitle', label: 'Title' },
  { key: 'state', label: 'State' },
  { key: 'designatedArea', label: 'County / Area' },
  { key: 'incidentType', label: 'Type' },
  { key: 'declarationDate', label: 'Declared' },
]

export default function ExplorePage() {
  const navigate = useNavigate()
  const [cacheEntry, setCacheEntry] = useState<CacheEntry | null>(() =>
    getCachedDisasters(),
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>(() =>
    getCachedDisasters() === null ? 'loading' : 'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('declarationDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const controllerRef = useRef<AbortController | null>(null)

  const records = cacheEntry?.records ?? null

  const load = useCallback(async () => {
    const query: DisasterQuery = {
      startYear: DATA_START_YEAR,
      endYear: CURRENT_YEAR,
      state: null,
      incidentTypes: [],
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const result = await fetchDisasters(query, controller.signal)
      if (controller.signal.aborted) return
      setCachedDisasters(query, result)
      setCacheEntry(getCachedDisasters())
      setStatus('idle')
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

  const startLoad = () => {
    setStatus('loading')
    setErrorMessage('')
    void load()
  }

  useEffect(() => {
    if (getCachedDisasters() === null) void load()
    return () => controllerRef.current?.abort()
  }, [load])

  const visibleRows = useMemo(() => {
    if (records === null) return []
    return sortRecords(searchRecords(records, search), sortKey, sortDir)
  }, [records, search, sortKey, sortDir])

  const { rows, pageCount, total } = paginate(visibleRows, page, PAGE_SIZE)
  const safePage = Math.min(Math.max(1, page), pageCount)

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'declarationDate' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const firstRow = (safePage - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(safePage * PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Explore declarations
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Search and sort the declaration records loaded from FEMA. Click a row
          for details.
        </p>
      </div>

      {status === 'error' ? (
        <ErrorBanner message={errorMessage} onRetry={startLoad} />
      ) : null}

      {records === null && status === 'loading' ? <TableSkeleton rows={12} /> : null}

      {records === null && status === 'idle' ? (
        <EmptyState
          title="No declarations loaded yet"
          hint="Load the latest declarations from FEMA (2016 to now, all states), or apply filters on the dashboard first."
        >
          <button
            type="button"
            onClick={startLoad}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Load latest declarations
          </button>
        </EmptyState>
      ) : null}

      {records !== null ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="table-search" className="sr-only">
              Search declarations
            </label>
            <input
              id="table-search"
              type="search"
              value={search}
              placeholder="Search title, state, area, or type…"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:max-w-sm"
            />
            <p className="text-sm text-slate-500">
              {formatNumber(total)} of {formatNumber(records.length)}{' '}
              records
              {cacheEntry
                ? ` · fetched ${formatDate(new Date(cacheEntry.fetchedAt).toISOString())}`
                : ''}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        sortKey === column.key
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className="px-4 py-3 font-semibold text-slate-600"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        {column.label}
                        <span aria-hidden="true" className="text-xs">
                          {sortKey === column.key
                            ? sortDir === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-slate-500">
                      No records match “{search}”.
                    </td>
                  </tr>
                ) : (
                  rows.map((record, index) => (
                    <tr
                      key={`${record.disasterNumber}-${index}`}
                      onClick={() =>
                        navigate(`/disaster/${record.disasterNumber}`)
                      }
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/disaster/${record.disasterNumber}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {record.declarationTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{record.state}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {record.designatedArea}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {record.incidentType}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(record.declarationDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {total > 0
                ? `Showing ${formatNumber(firstRow)}–${formatNumber(lastRow)} of ${formatNumber(total)}`
                : 'No records to show'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
