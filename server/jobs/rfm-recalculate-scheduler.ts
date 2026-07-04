import cron from "node-cron";
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

/**
 * Roda todos os dias às 3h da manhã (baixo tráfego), horário de São Paulo.
 * Não executa imediatamente ao subir o servidor: calculateRfm() faz um
 * UPDATE por cliente em loop, o que seria custoso a cada restart/deploy.
 */
cron.schedule("0 3 * * *", recalculateRfm, {
  timezone: "America/Sao_Paulo",
});

export { recalculateRfm };
