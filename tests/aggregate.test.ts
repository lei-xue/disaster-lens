import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  busiestYear,
  countByState,
  countByYear,
  countStates,
  mostFrequentType,
  shareByType,
} from '../src/lib/aggregate.ts'
import type { DisasterRecord } from '../src/lib/types.ts'

function record(overrides: Partial<DisasterRecord> = {}): DisasterRecord {
  return {
    disasterNumber: 1,
    state: 'CA',
    declarationTitle: 'FLOOD',
    incidentType: 'Flood',
    declarationDate: '2020-02-01T00:00:00.000Z',
    designatedArea: 'STATEWIDE',
    declarationType: 'DR',
    ...overrides,
  }
}

const FIXTURES: DisasterRecord[] = [
  record({ disasterNumber: 1, state: 'CA', incidentType: 'Flood', declarationDate: '2020-02-01T00:00:00.000Z' }),
  record({ disasterNumber: 2, state: 'CA', incidentType: 'Fire', declarationDate: '2020-03-01T00:00:00.000Z' }),
  record({ disasterNumber: 3, state: 'TX', incidentType: 'Flood', declarationDate: '2018-01-15T00:00:00.000Z' }),
  record({ disasterNumber: 4, state: 'TX', incidentType: 'Flood', declarationDate: '2020-05-10T00:00:00.000Z' }),
  record({ disasterNumber: 5, state: 'NY', incidentType: 'Hurricane', declarationDate: '2018-06-01T00:00:00.000Z' }),
]

describe('countByState', () => {
  it('counts records per state, sorted by count desc then name', () => {
    assert.deepEqual(countByState(FIXTURES), [
      { state: 'CA', count: 2 },
      { state: 'TX', count: 2 },
      { state: 'NY', count: 1 },
    ])
  })

  it('returns an empty array for empty input', () => {
    assert.deepEqual(countByState([]), [])
  })
})

describe('countByYear', () => {
  it('counts records per declaration year, sorted ascending', () => {
    assert.deepEqual(countByYear(FIXTURES), [
      { year: 2018, count: 2 },
      { year: 2020, count: 3 },
    ])
  })

  it('skips records with an unparsable date', () => {
    const broken = [record({ declarationDate: 'not-a-date' })]
    assert.deepEqual(countByYear(broken), [])
  })
})

describe('shareByType', () => {
  it('computes exact shares, sorted by count desc then name', () => {
    assert.deepEqual(shareByType(FIXTURES), [
      { type: 'Flood', count: 3, share: 0.6 },
      { type: 'Fire', count: 1, share: 0.2 },
      { type: 'Hurricane', count: 1, share: 0.2 },
    ])
  })

  it('uses an exact fraction for non-terminating divisions', () => {
    const three = [
      record({ incidentType: 'Flood' }),
      record({ incidentType: 'Fire' }),
      record({ incidentType: 'Hurricane' }),
    ]
    const shares = shareByType(three)
    assert.equal(shares[0].share, 1 / 3)
  })

  it('returns an empty array for empty input', () => {
    assert.deepEqual(shareByType([]), [])
  })
})

describe('kpis', () => {
  it('derives the headline numbers', () => {
    assert.equal(countStates(FIXTURES), 3)
    assert.equal(mostFrequentType(FIXTURES), 'Flood')
    assert.equal(busiestYear(FIXTURES), 2020)
  })

  it('returns nulls for empty input', () => {
    assert.equal(mostFrequentType([]), null)
    assert.equal(busiestYear([]), null)
    assert.equal(countStates([]), 0)
  })

  it('breaks busiest-year ties by picking the earliest year', () => {
    const tie = [
      record({ disasterNumber: 1, declarationDate: '2020-01-01T00:00:00.000Z' }),
      record({ disasterNumber: 2, declarationDate: '2021-01-01T00:00:00.000Z' }),
    ]
    assert.equal(busiestYear(tie), 2020)
  })
})
