import type { DisasterRecord } from './types.ts'

/** Dates describe loaded records, never completeness of the requested interval. */
export function loadedDateRange(records: DisasterRecord[]): { first: string; last: string } | null {
  let first = ''
  let last = ''
  for (const record of records) {
    const timestamp = Date.parse(record.declarationDate)
    if (!Number.isFinite(timestamp)) continue
    const date = new Date(timestamp).toISOString().slice(0, 10)
    if (!first || date < first) first = date
    if (!last || date > last) last = date
  }
  return first ? { first, last } : null
}
