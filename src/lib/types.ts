export interface DisasterRecord {
  disasterNumber: number
  state: string
  declarationTitle: string
  incidentType: string
  declarationDate: string
  designatedArea: string
  declarationType: string
}

export type DeclarationType = 'DR' | 'EM' | 'FM'
