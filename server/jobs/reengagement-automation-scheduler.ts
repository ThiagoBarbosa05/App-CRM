import cron from "node-cron";
import { runInactivityReengagement } from "../services/reengagement-automation.service";
import { withAutomationJobLock } from "../services/automation-job-lock.service";

const REENGAGEMENT_LOCK_KEY = 727_100_022;

/**
 * Verifica diariamente os clientes inativos e dispara a próxima mensagem da
 * régua de reengajamento configurada na aba de Regras (gatilho
 * "inactivity_reengagement"), respeitando intervalo de dias e número máximo
 * de tentativas de cada regra.
 */
async function checkInactivityReengagement(): Promise<void> {
  try {
    console.log("[Scheduler] Verificando régua de reengajamento por inatividade...");
    const ran = await withAutomationJobLock(REENGAGEMENT_LOCK_KEY, async () => {
      const result = await runInactivityReengagement();
      console.log(
        `[Scheduler] Reengajamento por inatividade: ${result.clientsChecked} cliente(s) verificado(s), ${result.sent} disparo(s) enviado(s).`,
      );
    });
    if (!ran) console.log("[Scheduler] Reengajamento já está em execução em outra instância.");
  } catch (error) {
    console.error(
      "[Scheduler] Erro ao verificar régua de reengajamento por inatividade:",
      error,
    );
  }
}

/**
 * Roda todos os dias às 8h30 (horário de São Paulo), logo após a verificação
 * de vencimento de cashback.
 */
cron.schedule("30 8 * * *", checkInactivityReengagement, {
  timezone: "America/Sao_Paulo",
});

export { checkInactivityReengagement };
