import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildDisasterQueryUrl,
  extractRecords,
  sameQuery,
  type DisasterQuery,
} from '../src/lib/fema.ts'

const BASE = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries'

const SELECT =
  '$select=disasterNumber%2Cstate%2CdeclarationTitle%2CincidentType%2CdeclarationDate%2CdesignatedArea%2CdeclarationType'

describe('buildDisasterQueryUrl', () => {
  it('builds a minimal URL with only the date range', () => {
    const query: DisasterQuery = {
      startYear: 2016,
      endYear: 2026,
      state: null,
      incidentTypes: [],
    }
    assert.equal(
      buildDisasterQueryUrl(query),
      `${BASE}?${SELECT}` +
        `&$filter=declarationDate%20ge%20'2016-01-01T00%3A00%3A00.000z'` +
        `%20and%20declarationDate%20le%20'2026-12-31T23%3A59%3A59.999z'` +
        `&$orderby=declarationDate%20desc` +
        `&$top=1000`,
    )
  })

  it('adds the state filter and paginates with $skip', () => {
    const query: DisasterQuery = {
      startYear: 2016,
      endYear: 2024,
      state: 'CA',
      incidentTypes: [],
    }
    const url = buildDisasterQueryUrl(query, 1000, 250)
    assert.equal(
      url,
      `${BASE}?${SELECT}` +
        `&$filter=declarationDate%20ge%20'2016-01-01T00%3A00%3A00.000z'` +
        `%20and%20declarationDate%20le%20'2024-12-31T23%3A59%3A59.999z'` +
        `%20and%20state%20eq%20'CA'` +
        '&$orderby=declarationDate%20desc' +
        '&$top=1000&$skip=250',
    )
  })

  it('joins multiple incident types into one or-clause', () => {
    const query: DisasterQuery = {
      startYear: 2020,
      endYear: 2020,
      state: null,
      incidentTypes: ['Flood', 'Fire'],
    }
    const url = buildDisasterQueryUrl(query, 1000, 0)
    assert.ok(
      url.includes(
        `&$filter=declarationDate%20ge%20'2020-01-01T00%3A00%3A00.000z'` +
        `%20and%20declarationDate%20le%20'2020-12-31T23%3A59%3A59.999z'` +
        `%20and%20(incidentType%20eq%20'Flood'%20or%20incidentType%20eq%20'Fire')`,
      ),
    )
  })

  it('omits $skip when it is zero', () => {
    const query: DisasterQuery = {
      startYear: 2016,
      endYear: 2026,
      state: null,
      incidentTypes: [],
    }
    const url = buildDisasterQueryUrl(query, 1000, 0)
    assert.ok(!url.includes('$skip'))
  })
})

describe('extractRecords', () => {
  it('reads records from the DisasterDeclarationsSummaries key', () => {
    const payload = {
      metadata: { count: 1 },
      DisasterDeclarationsSummaries: [{ disasterNumber: 1, state: 'CA' }],
    }
    assert.deepEqual(extractRecords(payload), [
      { disasterNumber: 1, state: 'CA' },
    ])
  })

  it('accepts a bare array', () => {
    assert.deepEqual(extractRecords([{ disasterNumber: 2 }]), [
      { disasterNumber: 2 },
    ])
  })

  it('throws on an unexpected shape', () => {
    assert.throws(() => extractRecords({ metadata: {} }))
    assert.throws(() => extractRecords(null))
  })
})

describe('sameQuery', () => {
  const base: DisasterQuery = {
    startYear: 2016,
    endYear: 2026,
    state: null,
    incidentTypes: [],
  }

  it('ignores incident type order', () => {
    assert.equal(
      sameQuery(
        { ...base, incidentTypes: ['Flood', 'Fire'] },
        { ...base, incidentTypes: ['Fire', 'Flood'] },
      ),
      true,
    )
  })

  it('detects a different state', () => {
    assert.equal(sameQuery(base, { ...base, state: 'CA' }), false)
  })

  it('detects different type counts', () => {
    assert.equal(
      sameQuery(base, { ...base, incidentTypes: ['Flood'] }),
      false,
    )
  })
})
