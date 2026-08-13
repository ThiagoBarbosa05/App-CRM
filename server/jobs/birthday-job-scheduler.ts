import { executeTodaysAutomations } from "./automation-catchup";

/**
 * Dispara as automações de aniversário cujo horário já chegou hoje.
 *
 * Antes este arquivo mantinha um `cron.schedule` por automação habilitada, num
 * mapa em memória, mais um cron horário que destruía e recriava todos eles.
 * Esse desenho não sobrevive a um processo que escala a zero: os crons morrem
 * junto com o container e as automações simplesmente não rodam.
 *
 * `executeTodaysAutomations` já foi escrita para ambiente serverless — ela lê
 * as automações do banco, checa `shouldExecuteNow(sendTime)` e
 * `wasExecutedToday`, e por isso é idempotente. Chamada em intervalo curto pelo
 * worker de background, entrega o mesmo comportamento sem estado em memória.
 */
export async function runBirthdayAutomations(): Promise<void> {
  try {
    const result = await executeTodaysAutomations();
    if (result.executedAutomations > 0 || result.failedAutomations > 0) {
      console.log(
        `[Scheduler] Aniversários: ${result.executedAutomations} automação(ões) executada(s), ${result.failedAutomations} com falha.`,
      );
    }
  } catch (error) {
    console.error("[Scheduler] Erro ao executar automações de aniversário:", error);
  }
}
