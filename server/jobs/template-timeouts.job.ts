import { processTemplateTimeouts } from "../services/whatsapp-bot-engine.service";

/** Roteia o handle `no_response` das sessões em nó de template que estouraram o prazo. */
export async function runTemplateTimeoutsTick(): Promise<void> {
  try {
    const count = await processTemplateTimeouts();
    if (count > 0) {
      console.log(`[TemplateTimeouts] ${count} sessão(ões) com no_response processada(s)`);
    }
  } catch (err) {
    console.error("[TemplateTimeouts] Erro:", err);
  }
}
