import {
  getMissedExecutions,
  recordExecution,
  shouldExecuteNow,
  wasExecutedToday,
} from "./automation-execution-tracker";
import { sendBirthdayMessagesForAutomation } from "./send-birthday-mensage";
import { messageAutomationSettings } from "../../shared/schema";

/**
 * Sistema de Catch-up para Automações
 *
 * Este sistema garante que automações sejam executadas mesmo em ambiente serverless:
 * 1. Detecta execuções perdidas quando o app acorda
 * 2. Executa automações que estavam agendadas mas não rodaram
 * 3. Previne duplicatas verificando logs de execução
 */

interface CatchupResult {
  totalAutomations: number;
  executedAutomations: number;
  failedAutomations: number;
  totalMessagesSent: number;
  errors: string[];
}

/**
 * Executa catch-up de automações perdidas
 * Esta função deve ser chamada:
 * - Ao inicializar o servidor
 * - Em intervalos regulares (ex: a cada request)
 * - Por um trigger externo (webhook, cron job)
 */
export async function executeCatchup(): Promise<CatchupResult> {
  console.log("[Catchup] Iniciando verificação de automações perdidas...");

  const result: CatchupResult = {
    totalAutomations: 0,
    executedAutomations: 0,
    failedAutomations: 0,
    totalMessagesSent: 0,
    errors: [],
  };

  try {
    // 1. Detectar automações perdidas
    const missedExecutions = await getMissedExecutions();

    if (missedExecutions.length === 0) {
      console.log("[Catchup] Nenhuma automação perdida encontrada.");
      return result;
    }

    console.log(
      `[Catchup] ${missedExecutions.length} automação(ões) com execuções perdidas encontrada(s).`
    );

    // 2. Processar cada automação perdida
    for (const { automation, missedDates } of missedExecutions) {
      result.totalAutomations++;

      console.log(
        `[Catchup] Processando automação ${automation.id} - ${missedDates.length} data(s) perdida(s)`
      );

      for (const missedDate of missedDates) {
        try {
          // Verificar novamente se não foi executada (evitar duplicatas)
          const alreadyExecuted = await wasExecutedToday(
            automation.id,
            missedDate
          );
          if (alreadyExecuted) {
            console.log(
              `[Catchup] Automação ${automation.id} já foi executada em ${missedDate} - pulando`
            );
            continue;
          }

          console.log(
            `[Catchup] Executando automação ${automation.id} para data ${missedDate}...`
          );

          // Executar automação
          const executionResult = await executeMissedAutomation(
            automation,
            missedDate
          );

          result.executedAutomations++;
          result.totalMessagesSent += executionResult.messagesSent;

          console.log(
            `[Catchup] ✅ Automação ${automation.id} executada para ${missedDate} - ${executionResult.messagesSent} mensagem(ns) enviada(s)`
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Catchup] ❌ Erro ao executar automação ${automation.id} para ${missedDate}:`,
            error
          );

          result.failedAutomations++;
          result.errors.push(`${automation.id} (${missedDate}): ${errorMsg}`);

          // Registrar falha
          await recordExecution({
            automationId: automation.id,
            executionDate: missedDate,
            scheduledTime: automation.sendTime,
            status: "failed",
            messagesProcessed: 0,
            messagesSent: 0,
            messagesFailed: 0,
            error: errorMsg,
            triggeredBy: "catchup",
          });
        }
      }
    }

    console.log(
      `[Catchup] Catch-up concluído: ${result.executedAutomations} executadas, ${result.failedAutomations} falhas, ${result.totalMessagesSent} mensagens enviadas`
    );
  } catch (error) {
    console.error("[Catchup] Erro crítico no sistema de catch-up:", error);
    result.errors.push(
      `Erro crítico: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Executa uma automação perdida para uma data específica
 */
async function executeMissedAutomation(
  automation: typeof messageAutomationSettings.$inferSelect,
  missedDate: string
): Promise<{
  messagesSent: number;
  messagesFailed: number;
}> {
  let messagesSent = 0;
  let messagesFailed = 0;

  try {
    console.log(
      `[Catchup] Processando automação ${automation.id} - ${automation.daysBefore} dias antes às ${automation.sendTime}`
    );

    // Executar automação (usa a mesma lógica do scheduler)
    await sendBirthdayMessagesForAutomation(automation.id);

    // TODO: Capturar métricas reais da execução
    messagesSent = 1; // Placeholder - será atualizado quando tivermos métricas

    // Registrar execução bem-sucedida
    await recordExecution({
      automationId: automation.id,
      executionDate: missedDate,
      scheduledTime: automation.sendTime,
      status: "success",
      messagesProcessed: messagesSent + messagesFailed,
      messagesSent,
      messagesFailed,
      triggeredBy: "catchup",
    });

    return { messagesSent, messagesFailed };
  } catch (error) {
    console.error(
      `[Catchup] Erro ao executar automação ${automation.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Executa automações do dia atual que ainda não rodaram
 * Esta função é mais leve e deve ser chamada com frequência
 */
export async function executeTodaysAutomations(): Promise<CatchupResult> {
  console.log("[Catchup] Verificando automações do dia...");

  const result: CatchupResult = {
    totalAutomations: 0,
    executedAutomations: 0,
    failedAutomations: 0,
    totalMessagesSent: 0,
    errors: [],
  };

  try {
    const db = (await import("../db")).db;
    const { eq } = await import("drizzle-orm");

    // Buscar automações ativas
    const automations = await db
      .select()
      .from(messageAutomationSettings)
      .where(eq(messageAutomationSettings.enabled, true));

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (const automation of automations) {
      result.totalAutomations++;

      // Verificar se já passou do horário agendado
      if (!shouldExecuteNow(automation.sendTime)) {
        console.log(
          `[Catchup] Automação ${automation.id} ainda não atingiu horário agendado (${automation.sendTime})`
        );
        continue;
      }

      // Verificar se já foi executada hoje
      const alreadyExecuted = await wasExecutedToday(automation.id, todayStr);
      if (alreadyExecuted) {
        console.log(
          `[Catchup] Automação ${automation.id} já executada hoje - pulando`
        );
        continue;
      }

      try {
        console.log(
          `[Catchup] Executando automação ${automation.id} do dia ${todayStr}...`
        );

        const executionResult = await executeMissedAutomation(
          automation,
          todayStr
        );

        result.executedAutomations++;
        result.totalMessagesSent += executionResult.messagesSent;

        console.log(
          `[Catchup] ✅ Automação ${automation.id} executada - ${executionResult.messagesSent} mensagem(ns) enviada(s)`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[Catchup] ❌ Erro ao executar automação ${automation.id}:`,
          error
        );

        result.failedAutomations++;
        result.errors.push(`${automation.id}: ${errorMsg}`);
      }
    }

    console.log(
      `[Catchup] Verificação do dia concluída: ${result.executedAutomations}/${result.totalAutomations} executadas`
    );
  } catch (error) {
    console.error("[Catchup] Erro ao verificar automações do dia:", error);
    result.errors.push(
      `Erro crítico: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Middleware para executar catch-up em requisições HTTP
 * Evita execuções duplicadas usando um lock simples
 */
let lastCatchupCheck = 0;
const CATCHUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
let isRunningCatchup = false;

export async function catchupMiddleware(
  req: any,
  res: any,
  next: () => void
): Promise<void> {
  // Não bloquear a requisição
  next();

  // Executar catch-up em background se necessário
  const now = Date.now();
  if (!isRunningCatchup && now - lastCatchupCheck > CATCHUP_INTERVAL_MS) {
    lastCatchupCheck = now;
    isRunningCatchup = true;

    // Executar em background
    executeTodaysAutomations()
      .catch((error) => {
        console.error("[Catchup Middleware] Erro no catch-up:", error);
      })
      .finally(() => {
        isRunningCatchup = false;
      });
  }
}
