import { storage } from "../storage";
import { 
  getContactByPhone, 
  syncContact, 
  createChat, 
  getBirthdayBots, 
  startBirthdayBot 
} from "../integrations/umbler";
import { createMessageJobsLog } from "../db/functions/create-message-jobs-logs";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";

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

/**
 * Job principal para envio de mensagens de aniversário
 * Este job é executado diariamente e processa todas as automações ativas
 */
export async function sendBirthdayMessages(): Promise<void> {
  console.log("[Birthday Job] Iniciando job de envio de mensagens de aniversário...");
  
  try {
    // 1. Buscar todas as automações ativas
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(automation => automation.enabled);
    
    if (activeAutomations.length === 0) {
      console.log("[Birthday Job] Nenhuma automação ativa encontrada.");
      return;
    }
    
    console.log(`[Birthday Job] Processando ${activeAutomations.length} automação(ões) ativa(s).`);
    
    // 2. Processar cada automação
    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }
    
    console.log("[Birthday Job] Job de envio de mensagens de aniversário concluído.");
    
  } catch (error) {
    console.error("[Birthday Job] Erro no job de envio de mensagens de aniversário:", error);
    throw error;
  }
}

/**
 * Processa uma automação específica
 */
async function processAutomation(automation: any): Promise<void> {
  console.log(`[Birthday Job] Processando automação ${automation.id} - Dias antes: ${automation.daysBefore}, Horário: ${automation.sendTime}`);
  
  try {
    // 1. Buscar clientes aniversariantes baseado na configuração
    const birthdayClients = await getBirthdayClients(automation.daysBefore);
    
    if (birthdayClients.length === 0) {
      console.log(`[Birthday Job] Nenhum cliente aniversariante encontrado para ${automation.daysBefore} dias antes.`);
      return;
    }
    
    console.log(`[Birthday Job] ${birthdayClients.length} cliente(s) aniversariante(s) encontrado(s).`);
    
    // 2. Processar cada cliente
    for (const client of birthdayClients) {
      await processClientBirthday(automation, client);
    }
    
  } catch (error) {
    console.error(`[Birthday Job] Erro ao processar automação ${automation.id}:`, error);
  }
}

/**
 * Busca clientes aniversariantes baseado nos dias antes configurados
 */
async function getBirthdayClients(daysBefore: number): Promise<ProcessedClient[]> {
  try {
    // Calcular a data alvo baseada nos dias antes
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);
    
    console.log(`[Birthday Job] Buscando clientes aniversariantes para ${targetDate.toDateString()} (${daysBefore} dias antes)`);
    
    // Buscar clientes com aniversário na data alvo usando função otimizada do storage
    const birthdayClients = await storage.getClientsByBirthdayDate(targetDate);
    
    // Filtrar apenas clientes com telefone válido
    const validClients = birthdayClients.filter(client => {
      if (!client.phone || client.phone.trim() === '') {
        console.log(`[Birthday Job] Cliente ${client.name} não possui telefone válido - ignorando`);
        return false;
      }
      return true;
    });
    
    return validClients.map(client => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      birthday: client.birthday!
    }));
    
  } catch (error) {
    console.error("[Birthday Job] Erro ao buscar clientes aniversariantes:", error);
    return [];
  }
}

/**
 * Processa o aniversário de um cliente específico
 */
async function processClientBirthday(automation: any, client: ProcessedClient): Promise<void> {
  const jobLog: BirthdayJobLog = {
    automationId: automation.id,
    clientId: client.id,
    scheduledSendAt: new Date(),
    status: "agendado",
    attempts: 0
  };
  
  try {
    console.log(`[Birthday Job] Processando cliente ${client.name} (${client.phone})`);
    
    // 1. Verificar/Sincronizar contato no Umbler
    const umblerContact = await syncClientWithUmbler(client);
    if (!umblerContact) {
      throw new Error("Falha ao sincronizar cliente com Umbler");
    }
    
    client.contactId = umblerContact.id;
    console.log(`[Birthday Job] Cliente sincronizado com Umbler - Contact ID: ${umblerContact.id}`);
    
    // 2. Criar chat no canal configurado
    const chatId = await createChatForClient(automation.externalChannelId, umblerContact.id);
    if (!chatId) {
      throw new Error("Falha ao criar chat no canal configurado");
    }
    
    client.chatId = chatId;
    console.log(`[Birthday Job] Chat criado - Chat ID: ${chatId}`);
    
    // 3. Buscar e disparar bot apropriado
    await triggerBirthdayBot(automation, client);
    
    // 4. Marcar como enviado
    jobLog.status = "enviado";
    jobLog.attempts = 1;
    
    console.log(`[Birthday Job] Mensagem de aniversário enviada com sucesso para ${client.name}`);
    
  } catch (error) {
    console.error(`[Birthday Job] Erro ao processar cliente ${client.name}:`, error);
    jobLog.status = "falhou";
    jobLog.attempts = 1;
    jobLog.lastError = error instanceof Error ? error.message : "Erro desconhecido";
  } finally {
    // 5. Registrar log do job
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
    console.log(`[Birthday Job] Criando novo contato no Umbler para ${client.name}`);
    const newContact = await syncContact({
      phoneNumber: client.phone,
      name: client.name,
      organizationId: process.env.UMBLER_ORGANIZATION_ID || ""
    });
    
    if (!newContact) {
      throw new Error("Falha ao criar contato no Umbler");
    }
    
    return newContact;
    
  } catch (error) {
    console.error(`[Birthday Job] Erro ao sincronizar cliente ${client.name} com Umbler:`, error);
    return null;
  }
}

/**
 * Cria chat para o cliente no canal especificado
 */
async function createChatForClient(channelId: string, contactId: string): Promise<string | null> {
  try {
    const chatResponse = await createChat({
      contactId,
      channelId
    });
    
    if (chatResponse && chatResponse.id) {
      return chatResponse.id;
    }
    
    return null;
    
  } catch (error) {
    console.error("[Birthday Job] Erro ao criar chat:", error);
    return null;
  }
}

/**
 * Busca e dispara o bot de aniversário apropriado
 */
async function triggerBirthdayBot(automation: any, client: ProcessedClient): Promise<void> {
  try {
    // 1. Buscar bots de aniversário
    const botsResponse = await getBirthdayBots();
    console.log(`[Birthday Job] ${botsResponse!.items.map(bot => bot.title).join(", ")} bot(s) de aniversário encontrado(s)`);
    
    if (!botsResponse || !botsResponse.items || botsResponse.items.length === 0) {
      throw new Error("Nenhum bot de aniversário encontrado");
    }
    
    // 2. Determinar qual bot usar baseado na configuração
    const botTitle = automation.daysBefore === 0 ? "ANIVERSARIO - NO DIA" : "ANIVERSARIO - DIAS ANTES";
    
    const targetBot = botsResponse.items.find(bot => 
      bot.title.toUpperCase().includes(botTitle.toUpperCase())
    );
    
    if (!targetBot) {
      throw new Error(`Bot "${botTitle}" não encontrado ou não está ativo`);
    }
    
    console.log(`[Birthday Job] Bot encontrado: ${targetBot.title} (${targetBot.id})`);
    
    // 3. Disparar o bot
    if (!client.chatId) {
      throw new Error("Chat ID não disponível para disparar bot");
    }
    
    // Determinar trigger name baseado no bot
    const triggerName = targetBot.triggers && targetBot.triggers.length > 0 
      ? targetBot.triggers[0] 
      : "aniversario";
    
    const botResult = await startBirthdayBot({
      chatId: client.chatId,
      botId: targetBot.id,
      triggerName: "Início"
    });
    
    if (!botResult) {
      throw new Error("Falha ao disparar bot de aniversário");
    }
    
    console.log(`[Birthday Job] Bot "${targetBot.title}" disparado com sucesso para ${client.name}`);
    
  } catch (error) {
    console.error("[Birthday Job] Erro ao disparar bot de aniversário:", error);
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
      lastError: log.lastError
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
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Permite uma janela de 5 minutos para execução
  const targetTime = new Date();
  const [hours, minutes] = sendTime.split(':').map(Number);
  targetTime.setHours(hours, minutes, 0, 0);
  
  const timeDiff = Math.abs(now.getTime() - targetTime.getTime());
  const fiveMinutes = 5 * 60 * 1000; // 5 minutos em millisegundos
  
  return timeDiff <= fiveMinutes;
}

/**
 * Função para executar apenas automações no horário correto
 */
export async function sendBirthdayMessagesScheduled(): Promise<void> {
  console.log("[Birthday Job Scheduled] Verificando automações para execução...");
  
  try {
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(automation => 
      automation.enabled && shouldRunAutomation(automation.sendTime)
    );
    
    if (activeAutomations.length === 0) {
      console.log("[Birthday Job Scheduled] Nenhuma automação para executar neste horário.");
      return;
    }
    
    console.log(`[Birthday Job Scheduled] Executando ${activeAutomations.length} automação(ões) no horário correto.`);
    
    for (const automation of activeAutomations) {
      await processAutomation(automation);
    }
    
  } catch (error) {
    console.error("[Birthday Job Scheduled] Erro no job agendado:", error);
    throw error;
  }
}