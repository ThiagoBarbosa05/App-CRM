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
import {
  getBirthdayAutomationConfig,
  type DuplicationStrategy,
} from "./birthday-automation-config";

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
  operationName: string
): Promise<{ result: T; attempts: number }> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(
        `[Retry] Tentativa ${attempt}/${config.maxRetries} para ${operationName}`
      );
      const result = await operation();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[Retry] Tentativa ${attempt} falhou para ${operationName}:`,
        lastError.message
      );

      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );
        console.log(
          `[Retry] Aguardando ${delay}ms antes da próxima tentativa...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Operação ${operationName} falhou após ${
      config.maxRetries
    } tentativas. Último erro: ${lastError!.message}`
  );
}

/**
 * Job principal para envio de mensagens de aniversário
 * Este job é executado diariamente e processa todas as automações ativas
 */
export async function sendBirthdayMessages(): Promise<void> {
  console.log(
    "[Birthday Job] Iniciando job de envio de mensagens de aniversário..."
  );

  try {
    // 1. Buscar todas as automações ativas
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(
      (automation) => automation.enabled
    );

    if (activeAutomations.length === 0) {
      console.log("[Birthday Job] Nenhuma automação ativa encontrada.");
      return;
    }

    console.log(
      `[Birthday Job] Processando ${activeAutomations.length} automação(ões) ativa(s).`
    );

    // 2. Processar cada automação
    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }

    console.log(
      "[Birthday Job] Job de envio de mensagens de aniversário concluído."
    );
  } catch (error) {
    console.error(
      "[Birthday Job] Erro no job de envio de mensagens de aniversário:",
      error
    );
    throw error;
  }
}

/**
 * Job para envio de mensagens de uma automação específica
 * Esta função é chamada pelo scheduler para processar apenas uma automação
 */
export async function sendBirthdayMessagesForAutomation(
  automationId: string
): Promise<void> {
  console.log(
    `[Birthday Job] Iniciando job para automação específica ${automationId}...`
  );

  try {
    // 1. Buscar a automação específica
    const automations = await getAllMessageAutomationSettings();
    const automation = automations.find(
      (auto) => auto.id === automationId && auto.enabled
    );

    if (!automation) {
      console.log(
        `[Birthday Job] Automação ${automationId} não encontrada ou não está ativa.`
      );
      return;
    }

    console.log(
      `[Birthday Job] Processando automação ${automation.id} - ${automation.daysBefore} dias antes às ${automation.sendTime}`
    );

    // 2. Processar apenas esta automação
    await processAutomation(automation);

    console.log(
      `[Birthday Job] Automação ${automationId} concluída com sucesso.`
    );
  } catch (error) {
    console.error(`[Birthday Job] Erro na automação ${automationId}:`, error);
    throw error;
  }
}

/**
 * Processa uma automação específica
 */
async function processAutomation(
  automation: MessageAutomationSettings
): Promise<void> {
  console.log(
    `[Birthday Job] Processando automação ${automation.id} - Dias antes: ${automation.daysBefore}, Horário: ${automation.sendTime}`
  );

  try {
    // 1. Buscar clientes aniversariantes baseado na configuração
    const birthdayClients = await getBirthdayClients(automation.daysBefore);

    if (birthdayClients.length === 0) {
      console.log(
        `[Birthday Job] Nenhum cliente aniversariante encontrado para ${automation.daysBefore} dias antes.`
      );
      return;
    }

    console.log(
      `[Birthday Job] ${birthdayClients.length} cliente(s) aniversariante(s) encontrado(s).`
    );

    // 2. Processar cada cliente
    for (const client of birthdayClients) {
      await processClientBirthday(automation, client);
    }
  } catch (error) {
    console.error(
      `[Birthday Job] Erro ao processar automação ${automation.id}:`,
      error
    );
  }
}

/**
 * Verifica se já foi enviada mensagem de aniversário para o cliente
 * Implementa múltiplas estratégias de prevenção de duplicatas
 */
async function hasAlreadySentBirthdayMessageThisYear(
  clientId: string,
  automationId: string,
  daysBefore: number,
  strategy: DuplicationStrategy = "per_day" // Mudança: agora previne duplicatas por dia
): Promise<boolean> {
  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    console.log(
      `[Birthday Job] Verificando duplicatas (${strategy}) para cliente ${clientId} - automação ${automationId} (${daysBefore} dias antes)`
    );

    // Buscar TODOS os logs de mensagens enviadas para este cliente no ano atual
    const logs = await getMessageJobsLogs({
      clientId,
      status: "enviado",
      page: 1,
      pageSize: 50,
    });

    const thisYearLogs = logs.data.filter((log) => {
      const logDate = new Date(log.actualSendAt || log.scheduledSendAt);
      return logDate >= yearStart && logDate <= yearEnd;
    });

    // Verificação básica: já foi enviado para esta automação específica?
    const alreadySentThisAutomation = thisYearLogs.some(
      (log) => log.automationId === automationId
    );

    if (alreadySentThisAutomation) {
      console.log(
        `[Birthday Job] ❌ DUPLICATA - Automação ${automationId} já executada para cliente ${clientId} neste ano`
      );
      return true;
    }

    // Aplicar estratégia adicional de prevenção
    switch (strategy) {
      case "per_automation":
        // Apenas a verificação básica acima
        break;

      case "per_day": {
        // Prevenir múltiplas mensagens para o mesmo dia de aniversário
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysBefore);

        // Verificar se já enviou mensagem hoje para o aniversário que está chegando
        const today = new Date().toDateString();
        const alreadySentToday = thisYearLogs.some((log) => {
          const logDate = new Date(log.actualSendAt || log.scheduledSendAt);
          return logDate.toDateString() === today;
        });

        if (alreadySentToday) {
          console.log(
            `[Birthday Job] ❌ DUPLICATA - Cliente ${clientId} já recebeu mensagem hoje (${today})`
          );
          return true;
        }
        break;
      }

      case "per_template": {
        // Prevenir múltiplos envios do mesmo template
        const currentAutomation = await getCurrentAutomation(automationId);
        if (!currentAutomation) break;

        const allAutomations = await getAllMessageAutomationSettings();
        const sameTemplateAutomations = allAutomations.filter(
          (auto) =>
            auto.externalTemplateId === currentAutomation.externalTemplateId
        );

        const alreadySentSameTemplate = thisYearLogs.some((log) =>
          sameTemplateAutomations.some((auto) => auto.id === log.automationId)
        );

        if (alreadySentSameTemplate) {
          console.log(
            `[Birthday Job] ❌ DUPLICATA - Cliente ${clientId} já recebeu template ${currentAutomation.externalTemplateId} neste ano`
          );
          return true;
        }
        break;
      }
    }

    console.log(
      `[Birthday Job] ✅ OK - Cliente ${clientId} pode receber mensagem (${strategy})`
    );

    return false;
  } catch (error) {
    console.error("[Birthday Job] Erro ao verificar duplicatas:", error);
    return false;
  }
}

/**
 * Função auxiliar para buscar uma automação específica
 */
async function getCurrentAutomation(
  automationId: string
): Promise<MessageAutomationSettings | null> {
  try {
    const automations = await getAllMessageAutomationSettings();
    return automations.find((auto) => auto.id === automationId) || null;
  } catch (error) {
    console.error("[Birthday Job] Erro ao buscar automação:", error);
    return null;
  }
}

/**
 * Busca clientes aniversariantes baseado nos dias antes configurados
 */
async function getBirthdayClients(
  daysBefore: number
): Promise<ProcessedClient[]> {
  try {
    // Calcular a data alvo baseada nos dias antes
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysBefore);

    const description =
      daysBefore === 0
        ? "hoje (dia do aniversário)"
        : daysBefore === 1
        ? "amanhã (1 dia antes)"
        : `em ${daysBefore} dias (${daysBefore} dias antes)`;

    console.log(
      `[Birthday Job] Buscando clientes que fazem aniversário ${description} - Data alvo: ${targetDate.toDateString()}`
    );

    // Buscar clientes com aniversário na data alvo usando função otimizada do storage
    const birthdayClients = await storage.getClientsByBirthdayDate(targetDate);

    // Filtrar apenas clientes com telefone válido
    const validClients = birthdayClients.filter((client) => {
      if (!client.phone || client.phone.trim() === "") {
        console.log(
          `[Birthday Job] Cliente ${client.name} não possui telefone válido - ignorando`
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
      error
    );
    return [];
  }
}

/**
 * Processa o aniversário de um cliente específico com retry e backoff
 */
async function processClientBirthday(
  automation: MessageAutomationSettings,
  client: ProcessedClient
): Promise<void> {
  const jobLog: BirthdayJobLog = {
    automationId: automation.id,
    clientId: client.id,
    scheduledSendAt: new Date(),
    status: "agendado",
    attempts: 0,
  };

  // Obter configurações do sistema
  const config = getBirthdayAutomationConfig();
  const retryConfig: RetryConfig = config.retryConfig;

  try {
    if (config.logging.verboseMode) {
      console.log(
        `[Birthday Job] Processando cliente ${client.name} (${client.phone}) - Estratégia: ${config.duplicationStrategy}`
      );
    }

    // 1. Verificar se já foi enviada mensagem de aniversário no ano atual
    const alreadySent = await hasAlreadySentBirthdayMessageThisYear(
      client.id,
      automation.id,
      automation.daysBefore,
      config.duplicationStrategy
    );
    if (alreadySent) {
      console.log(
        `[Birthday Job] Mensagem de aniversário já foi enviada para ${client.name} neste ano - pulando`
      );
      jobLog.status = "falhou";
      jobLog.lastError = "Mensagem já enviada neste ano";
      return;
    }

    // 2. Verificar/Sincronizar contato no Umbler com retry
    const umblerContactResult = await retryWithBackoff(
      () => syncClientWithUmbler(client),
      retryConfig,
      `sincronização do cliente ${client.name}`
    );

    if (!umblerContactResult.result) {
      throw new Error(
        "Falha ao sincronizar cliente com Umbler após todas as tentativas"
      );
    }

    const umblerContact = umblerContactResult.result;
    client.contactId = umblerContact.id;
    console.log(
      `[Birthday Job] Cliente sincronizado com Umbler - Contact ID: ${umblerContact.id} (${umblerContactResult.attempts} tentativas)`
    );

    // 3. Criar chat no canal configurado com retry
    const chatResult = await retryWithBackoff(
      () =>
        createChatForClient(automation.externalChannelId!, umblerContact.id),
      retryConfig,
      `criação de chat para ${client.name}`
    );

    if (!chatResult.result) {
      throw new Error(
        "Falha ao criar chat no canal configurado após todas as tentativas"
      );
    }

    client.chatId = chatResult.result;
    console.log(
      `[Birthday Job] Chat criado - Chat ID: ${chatResult.result} (${chatResult.attempts} tentativas)`
    );

    // 4. Enviar template message de aniversário com retry
    const templateResult = await retryWithBackoff(
      () => sendBirthdayTemplateMessage(automation, client),
      retryConfig,
      `envio de template message para ${client.name}`
    );

    // 5. Marcar como enviado
    jobLog.status = "enviado";
    jobLog.attempts = Math.max(
      umblerContactResult.attempts,
      chatResult.attempts,
      templateResult.attempts
    );

    if (config.logging.logSuccessfulSends) {
      console.log(
        `[Birthday Job] ✅ Mensagem de aniversário enviada com sucesso para ${client.name}`
      );
    }
  } catch (error) {
    console.error(
      `[Birthday Job] Erro ao processar cliente ${client.name}:`,
      error
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
      `[Birthday Job] Criando novo contato no Umbler para ${client.name}`
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
      error
    );
    throw error; // Propagar erro para permitir retry
  }
}

/**
 * Cria chat para o cliente no canal especificado
 */
async function createChatForClient(
  channelId: string,
  contactId: string
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
  client: ProcessedClient
): Promise<void> {
  try {
    if (!client.chatId) {
      throw new Error("Chat ID não disponível para enviar template message");
    }

    console.log(
      `[Birthday Job] Enviando template message para ${client.name} - Template ID: ${automation.externalTemplateId}`
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
      `[Birthday Job] Template message enviado com sucesso para ${client.name} - Message ID: ${result.id}`
    );
  } catch (error) {
    console.error(
      "[Birthday Job] Erro ao enviar template message de aniversário:",
      error
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
 * @deprecated Esta função não é mais necessária com o novo sistema de cron dinâmico
 */
export function shouldRunAutomation(sendTime: string): boolean {
  console.log(
    `[Birthday Job] DEPRECATED: shouldRunAutomation() não é mais necessária. O horário ${sendTime} agora é controlado pelo cron scheduler.`
  );
  return true; // Sempre retorna true pois o controle é feito pelo cron
}

/**
 * Função para executar apenas automações no horário correto
 * @deprecated Use sendBirthdayMessages() instead. O controle de horário agora é feito pelo cron scheduler.
 */
export async function sendBirthdayMessagesScheduled(): Promise<void> {
  console.log(
    "[Birthday Job Scheduled] DEPRECATED: Use sendBirthdayMessages() instead. Redirecionando..."
  );
  await sendBirthdayMessages();
}
