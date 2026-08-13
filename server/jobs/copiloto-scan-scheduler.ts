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
      `[Scheduler] Copiloto: ${result.generated} card(s) para ${result.sellers} vendedor(es), ` +
        `${result.backlogged} no backlog. ${result.skippedByCooldown} em cooldown.`,
      result.byType,
    );
  } catch (error) {
    console.error("[Scheduler] Erro ao gerar fila do Copiloto:", error);
  }
}

// Agendado pelo worker de background depois do recálculo de RFM das 3h (o
// sinal de campeão silencioso lê clients.rfm_segment) — ver
// server/jobs/registry.ts. Nunca roda no boot: a varredura é pesada e
// recriaria a fila sob os pés do vendedor no meio do dia.
export { scanCopiloto };
