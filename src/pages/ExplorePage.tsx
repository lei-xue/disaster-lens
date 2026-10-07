import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState.tsx'
import DataScope from '../components/DataScope.tsx'
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
import {
  readLastAppliedSnapshot,
  saveQuerySnapshot,
  syncSet,
} from '../lib/disasterCache.ts'
import { formatDate, formatNumber } from '../lib/format.ts'
import { paginate, searchRecords, sortRecords, type SortKey } from '../lib/tableUtils.ts'

const PAGE_SIZE = 25

// State, area and type move under the title below the sm breakpoint.
const COLUMNS: Array<{ key: SortKey; label: string; wideOnly?: boolean }> = [
  { key: 'declarationTitle', label: 'Title' },
  { key: 'state', label: 'State', wideOnly: true },
  { key: 'designatedArea', label: 'County / Area', wideOnly: true },
  { key: 'incidentType', label: 'Type', wideOnly: true },
  { key: 'declarationDate', label: 'Declared' },
]

export default function ExplorePage() {
  const [cacheEntry, setCacheEntry] = useState<CacheEntry | null>(() =>
    getCachedDisasters(),
  )
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('declarationDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const controllerRef = useRef<AbortController | null>(null)
  const tokenRef = useRef(0)

  const records = cacheEntry?.records ?? null

  const load = useCallback(async (query: DisasterQuery) => {
    const token = ++tokenRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const result = await fetchDisasters(query, controller.signal)
      if (controller.signal.aborted || tokenRef.current !== token) return
      const fetchedAt = Date.now()
      setCachedDisasters(query, result)
      syncSet(query, result, fetchedAt)
      await saveQuerySnapshot(query, result, fetchedAt)
      if (tokenRef.current !== token) return
      setCacheEntry({
        ...result,
        query: { ...query, incidentTypes: [...query.incidentTypes] },
        fetchedAt,
      })
      setStatus('idle')
    } catch (err) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return
      if (tokenRef.current !== token) return
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
    void load(
      cacheEntry?.query ?? {
        startYear: DATA_START_YEAR,
        endYear: CURRENT_YEAR,
        state: null,
        incidentTypes: [],
      },
    )
  }

  useEffect(() => {
    let cancelled = false
    const token = ++tokenRef.current
    void (async () => {
      const last = await readLastAppliedSnapshot()
      if (cancelled || tokenRef.current !== token) return
      if (last !== null) {
        const entry: CacheEntry = {
          query: last.query,
          records: last.records,
          limitReached: last.limitReached,
          fetchedAt: last.fetchedAt,
        }
        syncSet(last.query, last, last.fetchedAt)
        setCacheEntry(entry)
        if (!last.stale) {
          setStatus('idle')
          return
        }
        setStatus('loading')
        await load(last.query)
        return
      }
      setStatus('loading')
      await load({
        startYear: DATA_START_YEAR,
        endYear: CURRENT_YEAR,
        state: null,
        incidentTypes: [],
      })
    })()
    return () => {
      cancelled = true
      tokenRef.current += 1
      controllerRef.current?.abort()
    }
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
    <div className="dl-page">
      <header>
        <h1 className="dl-page-title">Explore declarations</h1>
      </header>

      {records === null && status === 'loading' ? <TableSkeleton rows={12} /> : null}

      {records === null && status === 'idle' ? (
        <EmptyState
          title="No declarations loaded yet"
          hint="Load the latest declarations from FEMA (2016 to now, all states), or apply filters on the dashboard first."
        >
          <button
            type="button"
            onClick={startLoad}
            className="dl-btn dl-btn-primary"
          >
            Load latest declarations
          </button>
        </EmptyState>
      ) : null}

      {records === null && status === 'error' ? (
        <ErrorBanner message={errorMessage} onRetry={startLoad} />
      ) : null}

      {records !== null ? (
        <section className="dl-record-workspace" aria-label="Declaration records">
          <div className="dl-record-toolbar">
            <div className="min-w-0 flex-1">
              <p className="dl-kicker">Records</p>
              {cacheEntry ? <DataScope entry={cacheEntry} /> : null}
              <p className="dl-meta mt-1">
                {formatNumber(total)} of {formatNumber(records.length)}{' '}
                records
                {cacheEntry
                  ? ` · ${status === 'error' ? 'stale snapshot' : status === 'loading' ? 'updating snapshot' : 'snapshot'} fetched ${new Date(cacheEntry.fetchedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC`
                  : ''}
              </p>
            </div>
            <div className="w-full sm:max-w-sm">
              <label htmlFor="table-search" className="dl-field-label">
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
                className="mt-1 w-full rounded-md border border-[var(--dl-line)] bg-[var(--dl-surface)] px-3 py-2 text-sm text-[var(--dl-ink)] placeholder:text-[var(--dl-ink-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-navy)]"
              />
            </div>
          </div>

          <div
            className="overflow-x-auto rounded-lg border border-[var(--dl-line)] bg-[var(--dl-surface)]"
            tabIndex={0}
            role="region"
            aria-label="Declaration records table, scroll horizontally to see all columns"
          >
            <table className="w-full text-left text-sm sm:min-w-3xl">
              <caption className="sr-only">
                Declaration records matching the current search. Column headers sort the table. Open a title link for declaration details.
              </caption>
              <thead className="border-b border-[var(--dl-line)] bg-[var(--dl-paper)]">
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
                      className={`${column.wideOnly ? 'hidden sm:table-cell' : ''} px-4 py-3 font-semibold whitespace-nowrap text-[var(--dl-ink-soft)]`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex min-h-11 items-center gap-1 px-1 font-semibold hover:text-[var(--dl-navy-deep)]"
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
              <tbody className="divide-y divide-[var(--dl-line)]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-[var(--dl-ink-soft)]">
                      No records match “{search}”.
                    </td>
                  </tr>
                ) : (
                  rows.map((record, index) => (
                    <tr
                      key={`${record.disasterNumber}-${index}`}
                      className="hover:bg-[var(--dl-paper)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/disaster/${record.disasterNumber}`}
                          className="dl-link font-medium"
                        >
                          {record.declarationTitle}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--dl-ink-soft)] sm:hidden">
                          {record.state} · {record.designatedArea} · {record.incidentType}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--dl-ink)] sm:table-cell">{record.state}</td>
                      <td className="hidden px-4 py-3 text-[var(--dl-ink)] sm:table-cell">
                        {record.designatedArea}
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--dl-ink)] sm:table-cell">
                        {record.incidentType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--dl-ink-soft)]">
                        {formatDate(record.declarationDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="dl-record-footer">
            <p className="dl-meta">
              {total > 0
                ? `Showing ${formatNumber(firstRow)}–${formatNumber(lastRow)} of ${formatNumber(total)}`
                : 'No records to show'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="dl-btn dl-btn-secondary"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--dl-ink-soft)]">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
                className="dl-btn dl-btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
