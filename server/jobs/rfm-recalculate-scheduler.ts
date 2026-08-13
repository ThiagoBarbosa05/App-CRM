import { calculateRfm } from "../services/rfm.service";

/**
 * Recalcula os scores RFM (recência/frequência/monetário) de todos os
 * clientes, usados pelo painel de "clientes com cadastro incompleto" e por
 * filtros/segmentação na tela de clientes.
 */
async function recalculateRfm(): Promise<void> {
  try {
    console.log("[Scheduler] Recalculando RFM de clientes...");
    const { updated, summary } = await calculateRfm();
    console.log(
      `[Scheduler] RFM recalculado: ${updated} cliente(s) atualizados.`,
      summary,
    );
  } catch (error) {
    console.error("[Scheduler] Erro ao recalcular RFM:", error);
  }
}

// Agendado às 3h (baixo tráfego) pelo worker de background — ver
// server/jobs/registry.ts. calculateRfm() faz um UPDATE por cliente em loop,
// então nunca deve rodar no boot de um processo.
export { recalculateRfm };
