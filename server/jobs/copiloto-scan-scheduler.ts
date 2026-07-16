import cron from "node-cron";

import { scanCopilotoSignals } from "../services/copiloto.service";

/**
 * Regenera a fila diária do Copiloto (cards de contato por vendedor) a partir
 * dos pedidos, do RFM e das interações.
 */
async function scanCopiloto(): Promise<void> {
  try {
    console.log("[Scheduler] Gerando fila do Copiloto...");
    const result = await scanCopilotoSignals();
    console.log(
      `[Scheduler] Copiloto: ${result.generated} card(s) para ${result.sellers} vendedor(es). ` +
        `${result.skippedByCooldown} em cooldown, ${result.cappedOut} acima do teto diário.`,
      result.byType,
    );
  } catch (error) {
    console.error("[Scheduler] Erro ao gerar fila do Copiloto:", error);
  }
}

/**
 * Roda às 5h, depois do recálculo de RFM das 3h (rfm-recalculate-scheduler),
 * já que o sinal de campeão silencioso lê clients.rfm_segment. Não executa ao
 * subir o servidor: a varredura é pesada e um deploy no meio do dia recriaria a
 * fila sob os pés do vendedor.
 */
cron.schedule("0 5 * * *", scanCopiloto, {
  timezone: "America/Sao_Paulo",
});

export { scanCopiloto };
