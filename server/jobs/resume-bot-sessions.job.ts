import cron from "node-cron";
import { resumeWaitingSessions } from "../services/whatsapp-bot-engine.service";

// Roda a cada minuto e retoma sessões pausadas por um nó de espera (Aguardar)
// cujo resumeAt já chegou.
export function startResumeBotSessionsJob() {
  let running = false;
  cron.schedule("*/1 * * * *", async () => {
    if (running) return;
    running = true;
    try {
      const count = await resumeWaitingSessions();
      if (count > 0) {
        console.log(`[ResumeBotSessions] ${count} sessão(ões) retomada(s)`);
      }
    } catch (err) {
      console.error("[ResumeBotSessions] Erro:", err);
    } finally {
      running = false;
    }
  });
}
