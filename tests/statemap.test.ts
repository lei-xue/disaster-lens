import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { US_STATES } from '../src/lib/constants.ts'
import {
  CHOROPLETH_COUNT_COLORS,
  CHOROPLETH_ZERO_COLOR,
  FIPS_TO_POSTAL,
  colorForCount,
  countBucket,
  fipsToPostal,
} from '../src/lib/statemap.ts'

const TERRITORIES = ['AS', 'GU', 'MP', 'PR', 'VI']

describe('FIPS_TO_POSTAL', () => {
  it('covers exactly the 50 states plus DC', () => {
    assert.equal(Object.keys(FIPS_TO_POSTAL).length, 51)
    assert.equal(new Set(Object.values(FIPS_TO_POSTAL)).size, 51)
    assert.equal(FIPS_TO_POSTAL['11'], 'DC')
  })

  it('maps every US_STATES code except the territories', () => {
    const mapped = new Set(Object.values(FIPS_TO_POSTAL))
    for (const { code } of US_STATES) {
      if (TERRITORIES.includes(code)) continue
      assert.ok(mapped.has(code), `missing postal code ${code}`)
    }
  })

  it('does not map territories or unknown ids', () => {
    for (const fips of ['60', '66', '69', '72', '78', '03', '99', '']) {
      assert.equal(fipsToPostal(fips), null)
    }
  })

  it('accepts zero-padded strings and numeric ids', () => {
    assert.equal(fipsToPostal('06'), 'CA')
    assert.equal(fipsToPostal('6'), 'CA')
    assert.equal(fipsToPostal(48), 'TX')
  })
})

describe('countBucket', () => {
  it('returns -1 for zero counts or an empty scale', () => {
    assert.equal(countBucket(0, 100), -1)
    assert.equal(countBucket(0, 0), -1)
    assert.equal(countBucket(5, 0), -1)
  })

  it('splits positive counts into equal-width steps', () => {
    assert.equal(countBucket(1, 10), 0)
    assert.equal(countBucket(2, 10), 0)
    assert.equal(countBucket(3, 10), 1)
    assert.equal(countBucket(5, 10), 2)
    assert.equal(countBucket(8, 10), 3)
    assert.equal(countBucket(9, 10), 4)
    assert.equal(countBucket(10, 10), 4)
  })

  it('never decreases as the count grows', () => {
    let previous = -1
    for (let count = 1; count <= 250; count++) {
      const bucket = countBucket(count, 250)
      assert.ok(bucket >= previous, `bucket decreased at count ${count}`)
      previous = bucket
    }
    assert.equal(previous, CHOROPLETH_COUNT_COLORS.length - 1)
  })
})

describe('colorForCount', () => {
  it('uses the muted color for zero-count states', () => {
    assert.equal(colorForCount(0, 1000), CHOROPLETH_ZERO_COLOR)
  })

  it('uses the muted color when every count is zero', () => {
    assert.equal(colorForCount(0, 0), CHOROPLETH_ZERO_COLOR)
  })

  it('reaches the lightest step for the smallest counts and the darkest for the maximum', () => {
    assert.equal(colorForCount(1, 100), CHOROPLETH_COUNT_COLORS[0])
    assert.equal(
      colorForCount(100, 100),
      CHOROPLETH_COUNT_COLORS[CHOROPLETH_COUNT_COLORS.length - 1],
    )
  })

  it('only returns colors from the scale', () => {
    const palette = new Set([CHOROPLETH_ZERO_COLOR, ...CHOROPLETH_COUNT_COLORS])
    for (let count = 0; count <= 97; count++) {
      assert.ok(palette.has(colorForCount(count, 97)), `unexpected color at count ${count}`)
    }
  })
})
