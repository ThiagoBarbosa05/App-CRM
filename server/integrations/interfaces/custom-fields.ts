export type CustomFields = CustomField[]

export interface CustomField {
  _t: string
  id: string
  customFieldDefinitionId: string
  value: any
}
