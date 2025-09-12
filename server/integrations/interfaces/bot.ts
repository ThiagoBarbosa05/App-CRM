export interface BotResponse {
  bot: Bot
}

export interface Bot {
  _t: string
  id: string
  createdAtUTC: string
  channels: Channel[]
  title: string
  order: number
  final: boolean
  active: boolean
  groupIds: string[]
  updatedAtUTC: string
  executionsCount: number
  executionsDateUTC: string
}

export interface Channel {
  _t: string
  id: string
}
