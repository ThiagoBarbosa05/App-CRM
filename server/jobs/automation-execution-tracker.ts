import { db } from "../db";
import {
  automationExecutionLogs,
  messageAutomationSettings,
} from "../../shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

/**
 * Sistema de rastreamento de execuções de automação
 * Garante que automações sejam executadas mesmo em ambiente serverless
 */

interface ExecutionRecord {
  automationId: string;
  executionDate: string;
  scheduledTime: string;
  status: "success" | "partial" | "failed";
  messagesProcessed: number;
  messagesSent: number;
  messagesFailed: number;
  error?: string;
  triggeredBy: "cron" | "manual" | "catchup" | "external";
}

/**
 * Registra uma execução de automação
 */
export async function recordExecution(record: ExecutionRecord): Promise<void> {
  try {
    await db.insert(automationExecutionLogs).values({
      automationId: record.automationId,
      executionDate: record.executionDate,
      scheduledTime: record.scheduledTime,
      status: record.status,
      messagesProcessed: record.messagesProcessed,
      messagesSent: record.messagesSent,
      messagesFailed: record.messagesFailed,
      error: record.error,
      triggeredBy: record.triggeredBy,
    });

    console.log(
      `[Execution Tracker] Execução registrada: Automação ${record.automationId} - ${record.executionDate} ${record.scheduledTime} - Status: ${record.status}`
    );
  } catch (error) {
    console.error("[Execution Tracker] Erro ao registrar execução:", error);
  }
}

/**
 * Verifica se uma automação já foi executada em uma data específica
 */
export async function wasExecutedToday(
  automationId: string,
  date: string = getTodayDateString()
): Promise<boolean> {
  try {
    const executions = await db
      .select()
      .from(automationExecutionLogs)
      .where(
        and(
          eq(automationExecutionLogs.automationId, automationId),
          eq(automationExecutionLogs.executionDate, date),
          eq(automationExecutionLogs.status, "success")
        )
      )
      .limit(1);

    return executions.length > 0;
  } catch (error) {
    console.error("[Execution Tracker] Erro ao verificar execução:", error);
    return false;
  }
}

/**
 * Busca última execução de uma automação
 */
export async function getLastExecution(
  automationId: string
): Promise<typeof automationExecutionLogs.$inferSelect | null> {
  try {
    const executions = await db
      .select()
      .from(automationExecutionLogs)
      .where(eq(automationExecutionLogs.automationId, automationId))
      .orderBy(desc(automationExecutionLogs.actualExecutionTime))
      .limit(1);

    return executions[0] || null;
  } catch (error) {
    console.error("[Execution Tracker] Erro ao buscar última execução:", error);
    return null;
  }
}

/**
 * Detecta automações que deveriam ter sido executadas mas não foram
 */
export async function getMissedExecutions(): Promise<
  Array<{
    automation: typeof messageAutomationSettings.$inferSelect;
    missedDates: string[];
  }>
> {
  try {
    // Buscar todas as automações ativas
    const automations = await db
      .select()
      .from(messageAutomationSettings)
      .where(eq(messageAutomationSettings.enabled, true));

    const missedExecutions: Array<{
      automation: typeof messageAutomationSettings.$inferSelect;
      missedDates: string[];
    }> = [];

    const today = new Date();
    const todayStr = getTodayDateString();

    for (const automation of automations) {
      // Buscar última execução
      const lastExecution = await getLastExecution(automation.id);

      // Se nunca foi executada, considerar os últimos 7 dias
      if (!lastExecution) {
        const missedDates = getLast7Days();
        console.log(
          `[Execution Tracker] Automação ${
            automation.id
          } nunca executada - Datas perdidas: ${missedDates.join(", ")}`
        );
        missedExecutions.push({ automation, missedDates });
        continue;
      }

      // Verificar dias perdidos desde a última execução
      const lastExecutionDate = new Date(lastExecution.executionDate);
      const missedDates: string[] = [];

      // Calcular dias entre última execução e hoje
      let checkDate = new Date(lastExecutionDate);
      checkDate.setDate(checkDate.getDate() + 1); // Começar do dia seguinte

      while (checkDate <= today) {
        const dateStr = formatDate(checkDate);

        // Não processar o dia de hoje se ainda não passou o horário
        if (dateStr === todayStr) {
          const now = new Date();
          const [scheduledHour, scheduledMinute] =
            automation.sendTime.split(":");
          const scheduledTime = new Date();
          scheduledTime.setHours(
            parseInt(scheduledHour),
            parseInt(scheduledMinute),
            0,
            0
          );

          if (now < scheduledTime) {
            break; // Ainda não é hora de executar hoje
          }
        }

        // Verificar se foi executada nesta data
        const wasExecuted = await wasExecutedToday(automation.id, dateStr);
        if (!wasExecuted) {
          missedDates.push(dateStr);
        }

        checkDate.setDate(checkDate.getDate() + 1);
      }

      if (missedDates.length > 0) {
        console.log(
          `[Execution Tracker] Automação ${
            automation.id
          } - Datas perdidas: ${missedDates.join(", ")}`
        );
        missedExecutions.push({ automation, missedDates });
      }
    }

    return missedExecutions;
  } catch (error) {
    console.error(
      "[Execution Tracker] Erro ao detectar execuções perdidas:",
      error
    );
    return [];
  }
}

/**
 * Utilitários de data
 */
function getTodayDateString(): string {
  return formatDate(new Date());
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLast7Days(): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(formatDate(date));
  }

  return dates;
}

/**
 * Verifica se o horário atual já passou do horário agendado
 */
export function shouldExecuteNow(scheduledTime: string): boolean {
  const now = new Date();
  const [scheduledHour, scheduledMinute] = scheduledTime.split(":");

  const scheduledDateTime = new Date();
  scheduledDateTime.setHours(
    parseInt(scheduledHour),
    parseInt(scheduledMinute),
    0,
    0
  );

  return now >= scheduledDateTime;
}

/**
 * Limpa execuções antigas (manter apenas últimos 30 dias)
 */
export async function cleanOldExecutions(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await db
      .delete(automationExecutionLogs)
      .where(gte(automationExecutionLogs.createdAt, thirtyDaysAgo));

    console.log("[Execution Tracker] Execuções antigas limpas (>30 dias)");
  } catch (error) {
    console.error(
      "[Execution Tracker] Erro ao limpar execuções antigas:",
      error
    );
  }
}
