import { storage } from "../storage";
import {
  getContactByPhone,
  syncContact,
  createChat,
  sendTemplateMessage,
  SendTemplateMessageRequest,
} from "../integrations/umbler";
import { createMessageJobsLog } from "../db/functions/create-message-jobs-logs";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";
import { getMessageJobsLogs } from "../db/functions/get-message-jobs-logs";
import { MessageAutomationSettings } from "server/db/functions/update-message-automation-settings";

interface ProcessedClient {
  id: string;
  name: string;
  phone: string;
  birthday: string;
  contactId?: string;
  chatId?: string;
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

/**
 * Utilitário para implementar retry com backoff exponencial
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string,
): Promise<{ result: T; attempts: number }> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(
        `[Retry] Tentativa ${attempt}/${config.maxRetries} para ${operationName}`,
      );
      const result = await operation();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Retry] Tentativa ${attempt} falhou para ${operationName}:`,
        lastError.message,
      );

      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs,
        );
        console.log(
          `[Retry] Aguardando ${delay}ms antes da próxima tentativa...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Operação ${operationName} falhou após ${
      config.maxRetries
    } tentativas. Último erro: ${lastError!.message}`,
  );
}

/**
 * Job principal para envio de mensagens de aniversário
 * Este job é executado diariamente e processa todas as automações ativas
 */
export async function sendBirthdayMessages(): Promise<void> {
  console.log(
    "[Birthday Job] Iniciando job de envio de mensagens de aniversário...",
  );

  try {
    // 1. Buscar todas as automações ativas
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(
      (automation) => automation.enabled,
    );

    if (activeAutomations.length === 0) {
      console.log("[Birthday Job] Nenhuma automação ativa encontrada.");
      return;
    }

    console.log(
      `[Birthday Job] Processando ${activeAutomations.length} automação(ões) ativa(s).`,
    );

    // 2. Processar cada automação
    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }

    console.log(
      "[Birthday Job] Job de envio de mensagens de aniversário concluído.",
    );
  } catch (error) {
    console.error(
      "[Birthday Job] Erro no job de envio de mensagens de aniversário:",
      error,
    );
    throw error;
  }
}

/**
 * Processa uma automação específica
 */
async function processAutomation(
  automation: MessageAutomationSettings,
): Promise<void> {
  console.log(
    `[Birthday Job] Processando automação ${automation.id} - Dias antes: ${automation.daysBefore}, Horário: ${automation.sendTime}`,
  );

  try {
    // 1. Buscar clientes aniversariantes baseado na configuração
    const birthdayClients = await getBirthdayClients(automation.daysBefore);

    if (birthdayClients.length === 0) {
      console.log(
        `[Birthday Job] Nenhum cliente aniversariante encontrado para ${automation.daysBefore} dias antes.`,
      );
      return;
    }

    console.log(
      `[Birthday Job] ${birthdayClients.length} cliente(s) aniversariante(s) encontrado(s).`,
    );

    // 2. Processar cada cliente
    for (const client of birthdayClients) {
      await processClientBirthday(automation, client);
    }
  } catch (error) {
    console.error(
      `[Birthday Job] Erro ao processar automação ${automation.id}:`,
      error,
    );
  }
}

/**
 * Verifica se já foi enviada mensagem de aniversário para o cliente no ano atual
 */
async function hasAlreadySentBirthdayMessageThisYear(
  clientId: string,
  automationId: string,
): Promise<boolean> {
  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1); // 1º de janeiro
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // 31 de dezembro

    // Buscar logs de mensagens enviadas para este cliente nesta automação no ano atual
    const logs = await getMessageJobsLogs({
      clientId,
      automationId,
      status: "enviado",
      page: 1,
      pageSize: 1,
    });

    // Verificar se existe algum log de envio bem-sucedido no ano atual
    const hasMessageThisYear = logs.data.some((log) => {
      const logDate = new Date(log.actualSendAt || log.scheduledSendAt);
      return logDate >= yearStart && logDate <= yearEnd;
    });

    return hasMessageThisYear;
  } catch (error) {
    console.error(
      "[Birthday Job] Erro ao verificar mensagens enviadas anteriormente:",
      error,
    );
    // Em caso de erro, assumir que não foi enviado para não bloquear o envio
    return false;
  }
}

/**
 * Busca clientes aniversariantes baseado nos dias antes configurados
 */
async function getBirthdayClients(
  daysBefore: number,
): Promise<ProcessedClient[]> {
  try {
    // Calcular a data alvo baseada nos dias antes
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);

    console.log(
      `[Birthday Job] Buscando clientes aniversariantes para ${targetDate.toDateString()} (${daysBefore} dias antes)`,
    );

    // Buscar clientes com aniversário na data alvo usando função otimizada do storage
    const birthdayClients = await storage.getClientsByBirthdayDate(targetDate);

    // Filtrar apenas clientes com telefone válido
    const validClients = birthdayClients.filter((client) => {
      if (!client.phone || client.phone.trim() === "") {
        console.log(
          `[Birthday Job] Cliente ${client.name} não possui telefone válido - ignorando`,
        );
        return false;
      }
      return true;
    });

    return validClients.map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      birthday: client.birthday!,
    }));
  } catch (error) {
    console.error(
      "[Birthday Job] Erro ao buscar clientes aniversariantes:",
      error,
    );
    return [];
  }
}

/**
 * Processa o aniversário de um cliente específico com retry e backoff
 */
async function processClientBirthday(
  automation: MessageAutomationSettings,
  client: ProcessedClient,
): Promise<void> {
  const jobLog: BirthdayJobLog = {
    automationId: automation.id,
    clientId: client.id,
    scheduledSendAt: new Date(),
    status: "agendado",
    attempts: 0,
  };

  // Configuração de retry
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 segundo
    maxDelayMs: 10000, // 10 segundos máximo
  };

  try {
    console.log(
      `[Birthday Job] Processando cliente ${client.name} (${client.phone})`,
    );

    // 1. Verificar se já foi enviada mensagem de aniversário no ano atual
    const alreadySent = await hasAlreadySentBirthdayMessageThisYear(
      client.id,
      automation.id,
    );
    if (alreadySent) {
      console.log(
        `[Birthday Job] Mensagem de aniversário já foi enviada para ${client.name} neste ano - pulando`,
      );
      jobLog.status = "falhou";
      jobLog.lastError = "Mensagem já enviada neste ano";
      return;
    }

    // 2. Verificar/Sincronizar contato no Umbler com retry
    const umblerContactResult = await retryWithBackoff(
      () => syncClientWithUmbler(client),
      retryConfig,
      `sincronização do cliente ${client.name}`,
    );

    if (!umblerContactResult.result) {
      throw new Error(
        "Falha ao sincronizar cliente com Umbler após todas as tentativas",
      );
    }

    const umblerContact = umblerContactResult.result;
    client.contactId = umblerContact.id;
    console.log(
      `[Birthday Job] Cliente sincronizado com Umbler - Contact ID: ${umblerContact.id} (${umblerContactResult.attempts} tentativas)`,
    );

    // 3. Criar chat no canal configurado com retry
    const chatResult = await retryWithBackoff(
      () =>
        createChatForClient(automation.externalChannelId!, umblerContact.id),
      retryConfig,
      `criação de chat para ${client.name}`,
    );

    if (!chatResult.result) {
      throw new Error(
        "Falha ao criar chat no canal configurado após todas as tentativas",
      );
    }

    client.chatId = chatResult.result;
    console.log(
      `[Birthday Job] Chat criado - Chat ID: ${chatResult.result} (${chatResult.attempts} tentativas)`,
    );

    // 4. Enviar template message de aniversário com retry
    const templateResult = await retryWithBackoff(
      () => sendBirthdayTemplateMessage(automation, client),
      retryConfig,
      `envio de template message para ${client.name}`,
    );

    // 5. Marcar como enviado
    jobLog.status = "enviado";
    jobLog.attempts = Math.max(
      umblerContactResult.attempts,
      chatResult.attempts,
      templateResult.attempts,
    );

    console.log(
      `[Birthday Job] Mensagem de aniversário enviada com sucesso para ${client.name}`,
    );
  } catch (error) {
    console.error(
      `[Birthday Job] Erro ao processar cliente ${client.name}:`,
      error,
    );
    jobLog.status = "falhou";
    jobLog.attempts = retryConfig.maxRetries;
    jobLog.lastError =
      error instanceof Error ? error.message : "Erro desconhecido";
  } finally {
    // 6. Registrar log do job
    await createJobLog(jobLog);
  }
}

/**
 * Sincroniza cliente com Umbler (verifica se existe, senão cria)
 */
async function syncClientWithUmbler(client: ProcessedClient): Promise<any> {
  try {
    // 1. Verificar se já existe no Umbler
    const existingContact = await getContactByPhone(client.phone);

    if (existingContact && existingContact.id) {
      console.log(`[Birthday Job] Cliente ${client.name} já existe no Umbler`);
      return existingContact;
    }

    // 2. Criar novo contato no Umbler
    console.log(
      `[Birthday Job] Criando novo contato no Umbler para ${client.name}`,
    );
    const newContact = await syncContact({
      phoneNumber: client.phone,
      name: client.name,
      organizationId: process.env.UMBLER_ORGANIZATION_ID || "",
    });

    if (!newContact) {
      throw new Error("Falha ao criar contato no Umbler");
    }

    return newContact;
  } catch (error) {
    console.error(
      `[Birthday Job] Erro ao sincronizar cliente ${client.name} com Umbler:`,
      error,
    );
    throw error; // Propagar erro para permitir retry
  }
}

/**
 * Cria chat para o cliente no canal especificado
 */
async function createChatForClient(
  channelId: string,
  contactId: string,
): Promise<string | null> {
  try {
    const chatResponse = await createChat({
      contactId,
      channelId,
    });

    if (chatResponse && chatResponse.id) {
      return chatResponse.id;
    }

    throw new Error("Resposta inválida ao criar chat");
  } catch (error) {
    console.error("[Birthday Job] Erro ao criar chat:", error);
    throw error; // Propagar erro para permitir retry
  }
}

/**
 * Envia template message de aniversário para o cliente
 */
async function sendBirthdayTemplateMessage(
  automation: any,
  client: ProcessedClient,
): Promise<void> {
  try {
    if (!client.chatId) {
      throw new Error("Chat ID não disponível para enviar template message");
    }

    console.log(
      `[Birthday Job] Enviando template message para ${client.name} - Template ID: ${automation.externalTemplateId}`,
    );

    // Preparar parâmetros do template (nome do cliente)
    const templateParams = [client.name.split(" ")[0]];

    // Preparar dados para envio do template message
    const templateMessageData: SendTemplateMessageRequest = {
      templateId: automation.externalTemplateId || "aMmf3pAPj514EiPb",
      chatId: client.chatId,
      organizationId: process.env.UMBLER_ORGANIZATION_ID || "",
      fileId: automation.externalFileId,
      params: templateParams,
    };

    // Enviar template message
    const result = await sendTemplateMessage(templateMessageData);

    if (!result) {
      throw new Error("Falha ao enviar template message de aniversário");
    }

    console.log(
      `[Birthday Job] Template message enviado com sucesso para ${client.name} - Message ID: ${result.id}`,
    );
  } catch (error) {
    console.error(
      "[Birthday Job] Erro ao enviar template message de aniversário:",
      error,
    );
    throw error;
  }
}

/**
 * Cria log do job no banco de dados
 */
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
    // Não propagar erro para não falhar o job principal
  }
}

/**
 * Função utilitária para verificar se é hora de executar uma automação
 */
export function shouldRunAutomation(sendTime: string): boolean {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  // Permite uma janela de 5 minutos para execução
  const targetTime = new Date();
  const [hours, minutes] = sendTime.split(":").map(Number);
  targetTime.setHours(hours, minutes, 0, 0);

  const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
  const fiveMinutes = 5 * 60 * 1000; // 5 minutos em millisegundos

  return timeDiff <= fiveMinutes;
}

/**
 * Função para executar apenas automações no horário correto
 */
export async function sendBirthdayMessagesScheduled(): Promise<void> {
  console.log(
    "[Birthday Job Scheduled] Verificando automações para execução...",
  );

  try {
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(
      (automation) =>
        automation.enabled && shouldRunAutomation(automation.sendTime),
    );

    if (activeAutomations.length === 0) {
      console.log(
        "[Birthday Job Scheduled] Nenhuma automação para executar neste horário.",
      );
      return;
    }

    console.log(
      `[Birthday Job Scheduled] Executando ${activeAutomations.length} automação(ões) no horário correto.`,
    );

    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }
  } catch (error) {
    console.error("[Birthday Job Scheduled] Erro no job agendado:", error);
    throw error;
  }
}
