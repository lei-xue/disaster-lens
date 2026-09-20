import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDate, formatNumber, formatShare } from '../src/lib/format.ts'
import { paginate, searchRecords, sortRecords } from '../src/lib/tableUtils.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

function record(overrides: Partial<DisasterRecord> = {}): DisasterRecord {
  return {
    disasterNumber: 1,
    state: 'CA',
    declarationTitle: 'SEVERE STORMS',
    incidentType: 'Severe Storm',
    declarationDate: '2020-02-01T00:00:00.000Z',
    designatedArea: 'Los Angeles (County)',
    declarationType: 'DR',
    ...overrides,
  }
}

const FIXTURES: DisasterRecord[] = [
  record({ disasterNumber: 1, state: 'CA', declarationTitle: 'Wildfires', incidentType: 'Fire', declarationDate: '2021-01-01T00:00:00.000Z' }),
  record({ disasterNumber: 2, state: 'TX', declarationTitle: 'Winter Storm', incidentType: 'Winter Storm', declarationDate: '2019-06-15T00:00:00.000Z', designatedArea: 'Harris (County)' }),
  record({ disasterNumber: 3, state: 'NY', declarationTitle: 'Hurricane Ida', incidentType: 'Hurricane', declarationDate: '2020-08-29T00:00:00.000Z' }),
]

describe('searchRecords', () => {
  it('matches title, state, area, and type case-insensitively', () => {
    assert.equal(searchRecords(FIXTURES, 'wildfires').length, 1)
    assert.equal(searchRecords(FIXTURES, 'TX').length, 1)
    assert.equal(searchRecords(FIXTURES, 'harris').length, 1)
    assert.equal(searchRecords(FIXTURES, 'HURRICANE').length, 1)
  })

  it('trims the query', () => {
    assert.equal(searchRecords(FIXTURES, '  ida  ').length, 1)
  })

  it('returns everything for a blank query', () => {
    assert.equal(searchRecords(FIXTURES, '').length, 3)
    assert.equal(searchRecords(FIXTURES, '   ').length, 3)
  })

  it('finds nothing when no field matches', () => {
    assert.equal(searchRecords(FIXTURES, 'zzz-no-match').length, 0)
  })
})

describe('sortRecords', () => {
  it('sorts ascending by title and does not mutate the input', () => {
    const sorted = sortRecords(FIXTURES, 'declarationTitle', 'asc')
    assert.deepEqual(
      sorted.map((r) => r.declarationTitle),
      ['Hurricane Ida', 'Wildfires', 'Winter Storm'],
    )
    assert.equal(FIXTURES[0].declarationTitle, 'Wildfires')
  })

  it('sorts descending by date', () => {
    const sorted = sortRecords(FIXTURES, 'declarationDate', 'desc')
    assert.deepEqual(
      sorted.map((r) => r.disasterNumber),
      [1, 3, 2],
    )
  })

  it('sorts by state ascending', () => {
    const sorted = sortRecords(FIXTURES, 'state', 'asc')
    assert.deepEqual(
      sorted.map((r) => r.state),
      ['CA', 'NY', 'TX'],
    )
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 30 }, (_, i) => i)

  it('returns the first page of 25 and a page count of 2', () => {
    const result = paginate(items, 1, 25)
    assert.equal(result.total, 30)
    assert.equal(result.pageCount, 2)
    assert.equal(result.rows.length, 25)
    assert.equal(result.rows[0], 0)
  })

  it('returns the short final page', () => {
    const result = paginate(items, 2, 25)
    assert.equal(result.rows.length, 5)
    assert.equal(result.rows[0], 25)
  })

  it('clamps out-of-range pages', () => {
    const result = paginate(items, 99, 25)
    assert.equal(result.rows.length, 5)
    assert.equal(result.rows[0], 25)
  })

  it('handles empty input', () => {
    const result = paginate([], 1, 25)
    assert.deepEqual(result, { rows: [], pageCount: 1, total: 0 })
  })
})

describe('formatters', () => {
  it('formats dates in US style', () => {
    assert.equal(formatDate('2020-02-01T00:00:00.000Z'), 'Feb 1, 2020')
  })

  it('falls back to the raw value for invalid dates', () => {
    assert.equal(formatDate('garbage'), 'garbage')
  })

  it('formats numbers and shares', () => {
    assert.equal(formatNumber(12345), '12,345')
    assert.equal(formatShare(0.605), '60.5%')
    assert.equal(formatShare(1), '100%')
    assert.equal(formatShare(0.002), '0.2%')
  })
})
