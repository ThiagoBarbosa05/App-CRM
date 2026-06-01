import { db } from "server/db";
import { clients, whatsappTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { createMessageJobsLog } from "../db/functions/create-message-jobs-logs";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";
import { getMessageJobsLogs } from "../db/functions/get-message-jobs-logs";
import { MessageAutomationSettings } from "server/db/functions/update-message-automation-settings";
import {
  getBirthdayAutomationConfig,
  type DuplicationStrategy,
} from "./birthday-automation-config";
import { AutomationExecutionService } from "../services/automation-execution.service";
import { storage } from "../storage";
import { formatPhoneToDigits } from "../lib/format-phone";

interface ProcessedClient {
  id: string;
  name: string;
  phone: string;
  birthday: string;
}

interface BirthdayJobLog {
  automationId: string;
  clientId: string;
  scheduledSendAt: Date;
  status: "agendado" | "enviado" | "falhou";
  attempts: number;
  lastError?: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string,
): Promise<{ result: T; attempts: number }> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Retry] Tentativa ${attempt}/${config.maxRetries} falhou para ${operationName}:`,
        lastError.message,
      );

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Operação ${operationName} falhou após ${config.maxRetries} tentativas. Último erro: ${lastError!.message}`,
  );
}

export async function sendBirthdayMessages(): Promise<void> {
  console.log("[Birthday Job] Iniciando job de envio de mensagens de aniversário...");

  try {
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter((a) => a.enabled);

    if (activeAutomations.length === 0) {
      console.log("[Birthday Job] Nenhuma automação ativa encontrada.");
      return;
    }

    console.log(`[Birthday Job] Processando ${activeAutomations.length} automação(ões) ativa(s).`);

    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }

    console.log("[Birthday Job] Job de envio de mensagens de aniversário concluído.");
  } catch (error) {
    console.error("[Birthday Job] Erro no job:", error);
    throw error;
  }
}

export async function sendBirthdayMessagesForAutomation(
  automationId: string,
  executionId?: string,
): Promise<void> {
  console.log(`[Birthday Job] Iniciando job para automação específica ${automationId}...`);

  try {
    const automations = await getAllMessageAutomationSettings();
    const automation = automations.find((a) => a.id === automationId && a.enabled);

    if (!automation) {
      console.log(`[Birthday Job] Automação ${automationId} não encontrada ou não está ativa.`);
      return;
    }

    await processAutomation(automation, executionId);

    console.log(`[Birthday Job] Automação ${automationId} concluída com sucesso.`);
  } catch (error) {
    console.error(`[Birthday Job] Erro na automação ${automationId}:`, error);
    throw error;
  }
}

async function processAutomation(
  automation: MessageAutomationSettings,
  executionId?: string,
): Promise<void> {
  let successCount = 0;
  let failureCount = 0;

  try {
    const birthdayClients = await getBirthdayClients(automation.daysBefore);

    if (birthdayClients.length === 0) {
      console.log(`[Birthday Job] Nenhum cliente aniversariante para ${automation.daysBefore} dias antes.`);
      if (executionId) await AutomationExecutionService.completeExecution(executionId, 0, 0);
      return;
    }

    console.log(`[Birthday Job] ${birthdayClients.length} cliente(s) aniversariante(s) encontrado(s).`);

    if (executionId) {
      await AutomationExecutionService.updateExecution(executionId, {
        totalClients: birthdayClients.length,
      });
    }

    for (let i = 0; i < birthdayClients.length; i++) {
      if (executionId && AutomationExecutionService.isCancelled(executionId)) {
        console.log(`[Birthday Job] Execução ${executionId} cancelada. Interrompendo.`);
        break;
      }

      const client = birthdayClients[i];

      try {
        await processClientBirthday(automation, client);
        successCount++;

        if (executionId && ((i + 1) % 5 === 0 || i === birthdayClients.length - 1)) {
          await AutomationExecutionService.updateProgress(executionId, i + 1, successCount, failureCount);
        }
      } catch (error) {
        failureCount++;
        console.error(`[Birthday Job] Erro ao processar cliente ${client.id}:`, error);
      }
    }

    if (executionId) {
      await AutomationExecutionService.completeExecution(executionId, successCount, failureCount);
    }

    console.log(`[Birthday Job] Concluído - Sucesso: ${successCount}, Falhas: ${failureCount}`);
  } catch (error) {
    console.error(`[Birthday Job] Erro ao processar automação ${automation.id}:`, error);

    if (executionId) {
      await AutomationExecutionService.failExecution(
        executionId,
        error instanceof Error ? error.message : String(error),
      );
    }

    throw error;
  }
}

async function hasAlreadySentBirthdayMessageThisYear(
  clientId: string,
  automationId: string,
  daysBefore: number,
  strategy: DuplicationStrategy = "per_day",
): Promise<boolean> {
  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const logs = await getMessageJobsLogs({ clientId, status: "enviado", page: 1, pageSize: 50 });

    const thisYearLogs = logs.data.filter((log) => {
      const logDate = new Date(log.actualSendAt || log.scheduledSendAt);
      return logDate >= yearStart && logDate <= yearEnd;
    });

    const alreadySentThisAutomation = thisYearLogs.some((log) => log.automationId === automationId);
    if (alreadySentThisAutomation) {
      console.log(`[Birthday Job] DUPLICATA - Automação ${automationId} já executada para cliente ${clientId} neste ano`);
      return true;
    }

    if (strategy === "per_day") {
      const today = new Date().toDateString();
      const alreadySentToday = thisYearLogs.some((log) => {
        const logDate = new Date(log.actualSendAt || log.scheduledSendAt);
        return logDate.toDateString() === today;
      });

      if (alreadySentToday) {
        console.log(`[Birthday Job] DUPLICATA - Cliente ${clientId} já recebeu mensagem hoje`);
        return true;
      }
    } else if (strategy === "per_template") {
      const allAutomations = await getAllMessageAutomationSettings();
      const currentAutomation = allAutomations.find((a) => a.id === automationId);
      if (currentAutomation) {
        const sameTemplateAutomations = allAutomations.filter(
          (a) => a.waTemplateId === currentAutomation.waTemplateId,
        );
        const alreadySentSameTemplate = thisYearLogs.some((log) =>
          sameTemplateAutomations.some((a) => a.id === log.automationId),
        );
        if (alreadySentSameTemplate) {
          console.log(`[Birthday Job] DUPLICATA - Cliente ${clientId} já recebeu este template neste ano`);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("[Birthday Job] Erro ao verificar duplicatas:", error);
    return false;
  }
}

async function getBirthdayClients(daysBefore: number): Promise<ProcessedClient[]> {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);

    const birthdayClients = await storage.getClientsByBirthdayDate(targetDate);

    return birthdayClients
      .filter((client) => {
        if (!client.phone?.trim()) {
          console.log(`[Birthday Job] Cliente ${client.name} sem telefone - ignorando`);
          return false;
        }
        return true;
      })
      .map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
        birthday: client.birthday!,
      }));
  } catch (error) {
    console.error("[Birthday Job] Erro ao buscar clientes aniversariantes:", error);
    return [];
  }
}

async function processClientBirthday(
  automation: MessageAutomationSettings,
  client: ProcessedClient,
): Promise<void> {
  const config = getBirthdayAutomationConfig();
  const retryConfig: RetryConfig = config.retryConfig;

  const jobLog: BirthdayJobLog = {
    automationId: automation.id,
    clientId: client.id,
    scheduledSendAt: new Date(),
    status: "agendado",
    attempts: 0,
  };

  try {
    if (config.logging.verboseMode) {
      console.log(`[Birthday Job] Processando cliente ${client.name} (${client.phone})`);
    }

    const alreadySent = await hasAlreadySentBirthdayMessageThisYear(
      client.id,
      automation.id,
      automation.daysBefore,
      config.duplicationStrategy,
    );

    if (alreadySent) {
      console.log(`[Birthday Job] Mensagem já enviada para ${client.name} neste ano - pulando`);
      jobLog.status = "falhou";
      jobLog.lastError = "Mensagem já enviada neste ano";
      return;
    }

    if (!automation.waTemplateId) {
      throw new Error(`Automação ${automation.id} não possui waTemplateId configurado`);
    }

    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, automation.waTemplateId));

    if (!template) {
      throw new Error(`Template ${automation.waTemplateId} não encontrado`);
    }

    const phoneE164 = formatPhoneToDigits(client.phone);

    const bodyParams = Array.isArray(template.bodyParams)
      ? template.bodyParams.map((param: unknown) => {
          const key = typeof param === "string" ? param : String(param);
          const value = key === "nome" ? client.name.split(" ")[0] : key;
          return { type: "text", text: value };
        })
      : [];

    const components =
      bodyParams.length > 0 ? [{ type: "body", parameters: bodyParams }] : undefined;

    const sendResult = await retryWithBackoff(
      () => sendTemplateMessage(phoneE164, template.name, template.languageCode, components),
      retryConfig,
      `envio de mensagem de aniversário para ${client.name}`,
    );

    jobLog.status = "enviado";
    jobLog.attempts = sendResult.attempts;

    if (config.logging.logSuccessfulSends) {
      console.log(`[Birthday Job] Mensagem de aniversário enviada para ${client.name}`);
    }
  } catch (error) {
    console.error(`[Birthday Job] Erro ao processar cliente ${client.name}:`, error);
    jobLog.status = "falhou";
    jobLog.attempts = retryConfig.maxRetries;
    jobLog.lastError = error instanceof Error ? error.message : "Erro desconhecido";
    throw error;
  } finally {
    await createJobLog(jobLog);
  }
}

async function createJobLog(log: BirthdayJobLog): Promise<void> {
  try {
    await createMessageJobsLog({
      automationId: log.automationId,
      clientId: log.clientId,
      scheduledSendAt: log.scheduledSendAt,
      actualSendAt: log.status === "enviado" ? new Date() : undefined,
      status: log.status,
      attempts: log.attempts,
      lastError: log.lastError,
    });
  } catch (error) {
    console.error("[Birthday Job] Erro ao criar log do job:", error);
  }
}

/** @deprecated O controle de horário agora é feito pelo cron scheduler. */
export function shouldRunAutomation(sendTime: string): boolean {
  console.log(`[Birthday Job] DEPRECATED: shouldRunAutomation() - horário ${sendTime} controlado pelo cron.`);
  return true;
}

/** @deprecated Use sendBirthdayMessages() diretamente. */
export async function sendBirthdayMessagesScheduled(): Promise<void> {
  await sendBirthdayMessages();
}
