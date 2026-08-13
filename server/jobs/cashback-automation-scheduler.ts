import cron from "node-cron";
import { runCashbackExpiringReminders } from "../services/cashback-automation.service";

/**
 * Verifica diariamente as regras de automação ativas com gatilho
 * "cashback_expiring" e dispara os lembretes de vencimento de cashback
 * configurados (canais, templates e intervalo em dias definidos na tela de
 * Regras). O dedupe por regra+transação evita reenvios em execuções futuras.
 */
async function checkCashbackExpiringReminders(): Promise<void> {
  try {
    console.log("[Scheduler] Verificando lembretes de vencimento de cashback...");
    const result = await runCashbackExpiringReminders();
    console.log(
      `[Scheduler] Lembretes de cashback: ${result.rulesChecked} regra(s) verificada(s), ${result.transactionsChecked} transação(ões) elegível(is), ${result.sent} disparo(s) enviado(s).`,
    );
  } catch (error) {
    console.error(
      "[Scheduler] Erro ao verificar lembretes de vencimento de cashback:",
      error,
    );
  }
}

/**
 * Roda todos os dias às 8h (horário de São Paulo), horário comercial em que
 * o cliente tem mais chance de ver a mensagem.
 */
cron.schedule("0 8 * * *", checkCashbackExpiringReminders, {
  timezone: "America/Sao_Paulo",
});

export { checkCashbackExpiringReminders };
