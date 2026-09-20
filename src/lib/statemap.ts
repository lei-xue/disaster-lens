export const FIPS_TO_POSTAL: Readonly<Record<string, string>> = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '11': 'DC',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
}

export function fipsToPostal(id: string | number): string | null {
  return FIPS_TO_POSTAL[String(id).padStart(2, '0')] ?? null
}

export const CHOROPLETH_ZERO_COLOR = '#cbd5e1'

export const CHOROPLETH_COUNT_COLORS = [
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#3b82f6',
  '#1d4ed8',
] as const

export function countBucket(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return -1
  const bucket = Math.floor(((count - 1) / maxCount) * CHOROPLETH_COUNT_COLORS.length)
  return Math.min(CHOROPLETH_COUNT_COLORS.length - 1, bucket)
}

export function colorForCount(count: number, maxCount: number): string {
  const bucket = countBucket(count, maxCount)
  return bucket === -1 ? CHOROPLETH_ZERO_COLOR : CHOROPLETH_COUNT_COLORS[bucket]
}
