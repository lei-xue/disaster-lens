import type { DisasterRecord } from './types'

export interface StateCount {
  state: string
  count: number
}

export interface YearCount {
  year: number
  count: number
}

export interface TypeShare {
  type: string
  count: number
  share: number
}

export function countByState(records: DisasterRecord[]): StateCount[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    counts.set(record.state, (counts.get(record.state) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
}

export function countByYear(records: DisasterRecord[]): YearCount[] {
  const counts = new Map<number, number>()
  for (const record of records) {
    const year = Number.parseInt(record.declarationDate.slice(0, 4), 10)
    if (Number.isNaN(year)) continue
    counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)
}

export function shareByType(records: DisasterRecord[]): TypeShare[] {
  const total = records.length
  if (total === 0) return []
  const counts = new Map<string, number>()
  for (const record of records) {
    counts.set(record.incidentType, (counts.get(record.incidentType) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count, share: count / total }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
}

export function countStates(records: DisasterRecord[]): number {
  return new Set(records.map((record) => record.state)).size
}

export function mostFrequentType(records: DisasterRecord[]): string | null {
  const shares = shareByType(records)
  return shares.length > 0 ? shares[0].type : null
}

export function busiestYear(records: DisasterRecord[]): number | null {
  const years = countByYear(records)
  if (years.length === 0) return null
  return [...years].sort((a, b) => b.count - a.count || a.year - b.year)[0].year
}
