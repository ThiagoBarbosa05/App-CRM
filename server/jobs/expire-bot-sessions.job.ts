import { expireInactiveSessions } from "../services/whatsapp-bot-engine.service";

/** Expira sessões de bot sem atividade por 30 minutos. */
export async function runExpireBotSessionsTick(): Promise<void> {
  try {
    const count = await expireInactiveSessions();
    if (count > 0) {
      console.log(`[ExpireBotSessions] ${count} sessão(ões) expirada(s)`);
    }
  } catch (err) {
    console.error("[ExpireBotSessions] Erro:", err);
  }
}
