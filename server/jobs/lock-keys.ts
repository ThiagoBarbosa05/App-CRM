/**
 * Chaves de advisory lock do Postgres usadas pelos jobs de background.
 *
 * Ficam todas aqui porque são um espaço de nomes global no banco: duas chaves
 * iguais em jobs diferentes fazem um deles pular ticks silenciosamente, sem
 * erro nem log. Foi exatamente o que aconteceu entre o dispatcher de e-mail e
 * o resume-bot-sessions, que compartilhavam 727_100_002.
 *
 * Ao adicionar um job novo, use o próximo número livre da sequência.
 */
export const LOCK_KEYS = {
  whatsappCampaignDispatch: 727_100_001,
  resumeBotSessions: 727_100_002,
  smsCampaignDispatch: 727_100_003,
  emailCampaignDispatch: 727_100_004,
} as const;
