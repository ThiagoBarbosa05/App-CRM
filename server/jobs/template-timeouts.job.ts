import cron from "node-cron";
import { processTemplateTimeouts } from "../services/whatsapp-bot-engine.service";

export function startTemplateTimeoutsJob() {
  let running = false;
  cron.schedule("*/1 * * * *", async () => {
    if (running) return;
    running = true;
    try {
      const count = await processTemplateTimeouts();
      if (count > 0) {
        console.log(`[TemplateTimeouts] ${count} sessão(ões) com no_response processada(s)`);
      }
    } catch (err) {
      console.error("[TemplateTimeouts] Erro:", err);
    } finally {
      running = false;
    }
  });
}
