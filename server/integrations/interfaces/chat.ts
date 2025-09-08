export interface ChatResponse {
  _t: string
  id: string
  createdAtUTC: string
  organization: Organization
  contact: Contact
  channel: Channel
  sector: Sector
  organizationMember: OrganizationMember
  organizationMembers: OrganizationMember2[]
  tags: Tag2[]
  lastMessage: LastMessage
  lastMessageReaction: LastMessageReaction
  redactReason: string
  usingInactivityFlow: boolean
  usingWaitingFlow: boolean
  inactivityFlowAt: string
  waitingFlowAt: string
  open: boolean
  private: boolean
  waiting: boolean
  waitingSinceUTC: string
  totalUnread: number
  totalAIResponses: number
  closedAtUTC: string
  eventAtUTC: string
  firstMemberReplyMessage: FirstMemberReplyMessage
  firstContactMessage: FirstContactMessage
  bots: Bot[]
  lastOrganizationMember: LastOrganizationMember
  message: Message
  visibility: string
  hasMessagesBeforeAllowedHistory: boolean
  latestMessages: LatestMessage[]
}

export interface Organization {
  _t: string
  id: string
}

export interface Contact {
  _t: string
  id: string
  name: string
  lastActiveUTC: string
  phoneNumber: string
  profilePictureUrl: string
  isBlocked: boolean
  scheduledMessages: ScheduledMessage[]
  groupIdentifier: string
  contactType: string
  tags: Tag[]
  preferences: Preference[]
}

export interface ScheduledMessage {
  _t: string
  id: string
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

export interface Preference {
  category: string
  value: string
  eventAtUTC: string
}

export interface Channel {
  _t: string
  id: string
  name: string
}

export interface Sector {
  _t: string
  id: string
  name: string
  default: boolean
  order: number
  groupIds: string[]
}

export interface OrganizationMember {
  _t: string
  id: string
  muted: boolean
  totalUnread: number
}

export interface OrganizationMember2 {
  _t: string
  id: string
  muted: boolean
  totalUnread: number
}

export interface Tag2 {
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

export interface LastMessage {
  _t: string
  id: string
  createdAtUTC: string
  prefix: string
  headerContent: string
  content: string
  footer: string
  file: File
  thumbnail: Thumbnail
  quotedStatusUpdate: QuotedStatusUpdate
  contacts: Contact2[]
  messageType: string
  sentByOrganizationMember: SentByOrganizationMember
  isPrivate: boolean
  location: Location
  question: Question
  source: string
  inReplyTo: InReplyTo
  messageState: string
  eventAtUTC: string
  chat: Chat
  fromContact: FromContact
  templateId: string
  buttons: Button2[]
  latestEdit: LatestEdit
  botInstance: BotInstance
  forwardedFrom: ForwardedFrom
  scheduledMessage: ScheduledMessage2
  bulkSendSession: BulkSendSession
  elements: string
  mentions: Mention[]
  ad: Ad
  fileId: string
  reactions: Reaction[]
  deductedAiCredits: number
  carousel: Carousel[]
  billable: Billable
}

export interface File {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Thumbnail {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface QuotedStatusUpdate {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Contact2 {
  name: string
  addresses: Address[]
  phoneNumbers: string[]
  company: string
  emails: string[]
  profilePictureBlob: string
}

export interface Address {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface SentByOrganizationMember {
  _t: string
  id: string
}

export interface Location {
  latitude: string
  longitude: string
  name: string
  address: string
}

export interface Question {
  _t: string
  id: string
  key: string
}

export interface InReplyTo {
  _t: string
  id: string
  chatId: string
  button: Button
}

export interface Button {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable {
  name: string
  example: string
}

export interface Chat {
  _t: string
  id: string
}

export interface FromContact {
  _t: string
  id: string
}

export interface Button2 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable2
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable2 {
  name: string
  example: string
}

export interface LatestEdit {
  content: string
  senderAtUTC: string
  msgKey: string
}

export interface BotInstance {
  _t: string
  id: string
  botName: string
}

export interface ForwardedFrom {
  _t: string
  id: string
  eventAtUTC: string
}

export interface ScheduledMessage2 {
  _t: string
  id: string
}

export interface BulkSendSession {
  _t: string
  id: string
}

export interface Mention {
  id: string
  source: string
}

export interface Ad {
  conversionSource: string
  sourceUrl: string
  description: string
  title: string
  thumbnailUrl: string
  mediaUrl: string
  sourceType: string
  sourceId: string
  fileId: string
  ctWaCLId: string
}

export interface Reaction {
  id: string
  emoji: string
  source: string
  eventAtUTC: string
  messageId: string
}

export interface Carousel {
  headerType: string
  body: string
  buttons: Button3[]
  fileUrl: string
}

export interface Button3 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable3
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable3 {
  name: string
  example: string
}

export interface Billable {
  billable: boolean
  singlePackageId: string
  deductedCredits: number
  billingConversationWindowId: string
}

export interface LastMessageReaction {
  id: string
  emoji: string
  source: string
  eventAtUTC: string
  messageId: string
}

export interface FirstMemberReplyMessage {
  _t: string
  id: string
  eventAtUTC: string
}

export interface FirstContactMessage {
  _t: string
  id: string
  eventAtUTC: string
}

export interface Bot {
  status: string
  botId: string
  botTitle: string
  botInstanceId: string
  triggerName: string
  stopReason: string
}

export interface LastOrganizationMember {
  _t: string
  id: string
}

export interface Message {
  _t: string
  id: string
  createdAtUTC: string
  prefix: string
  headerContent: string
  content: string
  footer: string
  file: File2
  thumbnail: Thumbnail2
  quotedStatusUpdate: QuotedStatusUpdate2
  contacts: Contact3[]
  messageType: string
  sentByOrganizationMember: SentByOrganizationMember2
  isPrivate: boolean
  location: Location2
  question: Question2
  source: string
  inReplyTo: InReplyTo2
  messageState: string
  eventAtUTC: string
  chat: Chat2
  fromContact: FromContact2
  templateId: string
  buttons: Button5[]
  latestEdit: LatestEdit2
  botInstance: BotInstance2
  forwardedFrom: ForwardedFrom2
  scheduledMessage: ScheduledMessage3
  bulkSendSession: BulkSendSession2
  elements: string
  mentions: Mention2[]
  ad: Ad2
  fileId: string
  reactions: Reaction2[]
  deductedAiCredits: number
  carousel: Carousel2[]
  billable: Billable2
}

export interface File2 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Thumbnail2 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface QuotedStatusUpdate2 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Contact3 {
  name: string
  addresses: Address2[]
  phoneNumbers: string[]
  company: string
  emails: string[]
  profilePictureBlob: string
}

export interface Address2 {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface SentByOrganizationMember2 {
  _t: string
  id: string
}

export interface Location2 {
  latitude: string
  longitude: string
  name: string
  address: string
}

export interface Question2 {
  _t: string
  id: string
  key: string
}

export interface InReplyTo2 {
  _t: string
  id: string
  chatId: string
  button: Button4
}

export interface Button4 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable4
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable4 {
  name: string
  example: string
}

export interface Chat2 {
  _t: string
  id: string
}

export interface FromContact2 {
  _t: string
  id: string
}

export interface Button5 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable5
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable5 {
  name: string
  example: string
}

export interface LatestEdit2 {
  content: string
  senderAtUTC: string
  msgKey: string
}

export interface BotInstance2 {
  _t: string
  id: string
  botName: string
}

export interface ForwardedFrom2 {
  _t: string
  id: string
  eventAtUTC: string
}

export interface ScheduledMessage3 {
  _t: string
  id: string
}

export interface BulkSendSession2 {
  _t: string
  id: string
}

export interface Mention2 {
  id: string
  source: string
}

export interface Ad2 {
  conversionSource: string
  sourceUrl: string
  description: string
  title: string
  thumbnailUrl: string
  mediaUrl: string
  sourceType: string
  sourceId: string
  fileId: string
  ctWaCLId: string
}

export interface Reaction2 {
  id: string
  emoji: string
  source: string
  eventAtUTC: string
  messageId: string
}

export interface Carousel2 {
  headerType: string
  body: string
  buttons: Button6[]
  fileUrl: string
}

export interface Button6 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable6
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable6 {
  name: string
  example: string
}

export interface Billable2 {
  billable: boolean
  singlePackageId: string
  deductedCredits: number
  billingConversationWindowId: string
}

export interface LatestMessage {
  _t: string
  id: string
  createdAtUTC: string
  prefix: string
  headerContent: string
  content: string
  footer: string
  file: File3
  thumbnail: Thumbnail3
  quotedStatusUpdate: QuotedStatusUpdate3
  contacts: Contact4[]
  messageType: string
  sentByOrganizationMember: SentByOrganizationMember3
  isPrivate: boolean
  location: Location3
  question: Question3
  source: string
  inReplyTo: InReplyTo3
  messageState: string
  eventAtUTC: string
  chat: Chat3
  fromContact: FromContact3
  templateId: string
  buttons: Button8[]
  latestEdit: LatestEdit3
  botInstance: BotInstance3
  forwardedFrom: ForwardedFrom3
  scheduledMessage: ScheduledMessage4
  bulkSendSession: BulkSendSession3
  elements: string
  mentions: Mention3[]
  ad: Ad3
  fileId: string
  reactions: Reaction3[]
  deductedAiCredits: number
  carousel: Carousel3[]
  billable: Billable3
  contactId?: string
}

export interface File3 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Thumbnail3 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface QuotedStatusUpdate3 {
  url: string
  contentType: string
  originalName: string
  originalSizeBytes: number
  data: string
  failDownload: boolean
  caption: string
}

export interface Contact4 {
  name: string
  addresses: Address3[]
  phoneNumbers: string[]
  company: string
  emails: string[]
  profilePictureBlob: string
}

export interface Address3 {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface SentByOrganizationMember3 {
  _t: string
  id: string
}

export interface Location3 {
  latitude: string
  longitude: string
  name: string
  address: string
}

export interface Question3 {
  _t: string
  id: string
  key: string
}

export interface InReplyTo3 {
  _t: string
  id: string
  chatId: string
  button: Button7
}

export interface Button7 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable7
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable7 {
  name: string
  example: string
}

export interface Chat3 {
  _t: string
  id: string
}

export interface FromContact3 {
  _t: string
  id: string
}

export interface Button8 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable8
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable8 {
  name: string
  example: string
}

export interface LatestEdit3 {
  content: string
  senderAtUTC: string
  msgKey: string
}

export interface BotInstance3 {
  _t: string
  id: string
  botName: string
}

export interface ForwardedFrom3 {
  _t: string
  id: string
  eventAtUTC: string
}

export interface ScheduledMessage4 {
  _t: string
  id: string
}

export interface BulkSendSession3 {
  _t: string
  id: string
}

export interface Mention3 {
  id: string
  source: string
}

export interface Ad3 {
  conversionSource: string
  sourceUrl: string
  description: string
  title: string
  thumbnailUrl: string
  mediaUrl: string
  sourceType: string
  sourceId: string
  fileId: string
  ctWaCLId: string
}

export interface Reaction3 {
  id: string
  emoji: string
  source: string
  eventAtUTC: string
  messageId: string
}

export interface Carousel3 {
  headerType: string
  body: string
  buttons: Button9[]
  fileUrl: string
}

export interface Button9 {
  _t: string
  text: string
  type: string
  phoneNumber: string
  url: string
  variable: Variable9
  selected: boolean
  copyCode: string
  postbackText: string
}

export interface Variable9 {
  name: string
  example: string
}

export interface Billable3 {
  billable: boolean
  singlePackageId: string
  deductedCredits: number
  billingConversationWindowId: string
}
