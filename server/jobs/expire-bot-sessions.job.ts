import cron from "node-cron";
import { expireInactiveSessions } from "../services/whatsapp-bot-engine.service";

// Roda a cada 5 minutos e expira sessões sem atividade por 30 minutos
export function startExpireBotSessionsJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const count = await expireInactiveSessions();
      if (count > 0) {
        console.log(`[ExpireBotSessions] ${count} sessão(ões) expirada(s)`);
      }
    } catch (err) {
      console.error("[ExpireBotSessions] Erro:", err);
    }
  });
}
