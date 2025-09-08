export interface CreateContactResponse {
  contact: Contact
  alreadyExisted: boolean
}

export interface Contact {
  _t: string
  id: string
  createdAtUTC: string
  name: string
  phoneNumber: string
  email: string
  profilePictureUrl: string
  isBlocked: boolean
  groupIdentifier: string
  contactType: string
  organizationMembers: string[]
  channelIds: string[]
  tags: Tag[]
  lastActiveUTC: string
  gender: string
  landline: string
  address: Address
  notes: Note[]
  customFields: CustomField[]
}

export interface Tag {
  _t: string
  id: string
  name: string
  emoji?: string
  color?: string
  description?: string
  order?: number
  createdAtUTC?: string
  groupIds?: string[]
}

export interface Address {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface Note {
  _t: string
  id: string
  createdAtUTC: string
  content: string
  pinned: boolean
  createdBy: string
  elements: string
  mentions: Mention[]
}

export interface Mention {
  id: string
  source: string
}

export interface CustomField {
  _t: string
  id: string
  customFieldDefinitionId: string
  value: any
}
