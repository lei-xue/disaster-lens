import type { DisasterRecord } from './types'

export type SortKey =
  | 'declarationTitle'
  | 'state'
  | 'designatedArea'
  | 'incidentType'
  | 'declarationDate'

export type SortDir = 'asc' | 'desc'

export function searchRecords(
  records: DisasterRecord[],
  query: string,
): DisasterRecord[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return records
  return records.filter((record) =>
    [
      record.declarationTitle,
      record.state,
      record.designatedArea,
      record.incidentType,
    ].some((field) => field.toLowerCase().includes(needle)),
  )
}

export function sortRecords(
  records: DisasterRecord[],
  key: SortKey,
  direction: SortDir,
): DisasterRecord[] {
  return [...records].sort((a, b) => {
    const result = a[key].localeCompare(b[key], 'en', { sensitivity: 'base' })
    return direction === 'asc' ? result : -result
  })
}

export interface PageResult<T> {
  rows: T[]
  pageCount: number
  total: number
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): PageResult<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  return {
    rows: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    pageCount,
    total,
  }
}
