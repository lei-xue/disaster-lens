import test from 'node:test'
import assert from 'node:assert/strict'
import { loadedDateRange } from '../src/lib/coverage.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

const records = (...dates: string[]) => dates.map(declarationDate => ({ declarationDate } as DisasterRecord))
test('loaded date range is ordered and based on records, not requested years', () => {
  assert.deepEqual(loadedDateRange(records('2026-02-01', '2024-12-01', '2025-01-01')), { first: '2024-12-01', last: '2026-02-01' })
})
test('empty and invalid dates do not invent coverage', () => {
  assert.equal(loadedDateRange([]), null)
  assert.equal(loadedDateRange(records('invalid')), null)
})
test('date range uses UTC and supports a single date', () => {
  assert.deepEqual(loadedDateRange(records('2025-01-01T23:30:00-02:00')), { first: '2025-01-02', last: '2025-01-02' })
})
