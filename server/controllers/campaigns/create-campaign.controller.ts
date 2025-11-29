import { Request, Response } from "express";
import {
  getContacts,
  createBulkSendSession,
  scheduleMessage,
  CreateBulkSendSessionRequest,
  ScheduleMessageRequest,
} from "../../integrations/umbler";
import { createCampaignSchema } from "./create-campaign.schema";
import { logCampaignCreation, logMessageStatus } from "./campaign-logger";
import { ZodError } from "zod";

interface CreateCampaignRequest {
  title: string;
  tagIds: string[];
  exclusiveTagFilter: boolean;
  botId: string;
  botTriggerName: string;
  channelId: string;
  fromPhone: string;
  scheduledDate: string; // ISO string format
  intervalSeconds: number; // Intervalo entre mensagens em segundos
  cancelUpon: string[]; // Opções: ["contato", "atendente", "conversa_finalizada"]
  organizationId: string;
}

/**
 * Valida se a data de agendamento está no mínimo 2 minutos no futuro
 * @param scheduledDate - Data em formato ISO string
 * @returns boolean indicando se a data é válida
 */
function validateScheduledDate(scheduledDate: string): {
  valid: boolean;
  message?: string;
} {
  const now = new Date();
  const scheduled = new Date(scheduledDate);

  // Verifica se a data é válida
  if (isNaN(scheduled.getTime())) {
    return {
      valid: false,
      message: "Data de agendamento inválida",
    };
  }

  // Calcula a diferença em minutos
  const diffInMs = scheduled.getTime() - now.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);

  if (diffInMinutes < 2) {
    return {
      valid: false,
      message: "A data de agendamento deve ser no mínimo 2 minutos no futuro",
    };
  }

  return { valid: true };
}

/**
 * Converte data local para UTC mantendo o horário escolhido pelo usuário
 * Exemplo: Se usuário escolheu 29/11/2025 19:00, será 19:00 UTC
 * @param localDateString - Data em formato ISO string local
 * @returns Data em formato ISO UTC string
 */
function convertToUTCMaintainingTime(localDateString: string): string {
  const date = new Date(localDateString);

  // Pega os componentes da data local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Monta a string no formato UTC mantendo o horário escolhido
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

/**
 * Controller para criar uma campanha de marketing
 * POST /api/umbler/campaigns
 */
export async function createCampaignController(req: Request, res: Response) {
  try {
    // Valida o body da requisição com Zod
    const validatedData = createCampaignSchema.parse(req.body);

    const {
      title,
      tagIds,
      exclusiveTagFilter,
      botId,
      botTriggerName,
      channelId,
      fromPhone,
      scheduledDate,
      intervalSeconds,
      cancelUpon,
      organizationId,
    } = validatedData;

    // Valida data de agendamento
    const dateValidation = validateScheduledDate(scheduledDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        error: dateValidation.message,
      });
    }

    // Busca contatos com filtro exclusivo de tags
    const contactsResponse = await getContacts(
      undefined,
      tagIds,
      exclusiveTagFilter
    );

    if (!contactsResponse || !contactsResponse.items) {
      return res.status(500).json({
        error: "Falha ao buscar contatos",
      });
    }

    const contacts = contactsResponse.items;

    if (contacts.length === 0) {
      return res.status(400).json({
        error: "Nenhum contato encontrado com as tags selecionadas",
        tagIds,
        exclusiveTagFilter,
      });
    }

    // Limite de segurança
    if (contacts.length > 500) {
      return res.status(400).json({
        error: "Número de contatos excede o limite de 500 por campanha",
        contactsCount: contacts.length,
        message:
          "Por favor, refine os filtros ou divida em múltiplas campanhas",
      });
    }

    // Cria a sessão de envio em lote
    const bulkSessionData: CreateBulkSendSessionRequest = {
      organizationId,
      channelId,
      title,
      expectedMessages: contacts.length,
      botId,
      triggerName: botTriggerName || "Início",
    };

    const bulkSession = await createBulkSendSession(bulkSessionData);

    if (!bulkSession) {
      return res.status(500).json({
        error: "Falha ao criar sessão de envio em lote",
      });
    }

    // Agenda mensagens individuais com intervalo
    const scheduledMessages: any[] = [];
    const failedMessages: any[] = [];
    let currentScheduledDate = new Date(scheduledDate);

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Calcula o horário de envio com intervalo
      if (i > 0) {
        currentScheduledDate = new Date(
          currentScheduledDate.getTime() + intervalSeconds * 1000
        );
      }

      const messageData: ScheduleMessageRequest = {
        BotId: botId,
        BotTriggerName: botTriggerName || "Início",
        BulkSession: bulkSession.id,
        CancelUpon: cancelUpon || [],
        ChannelId: null,
        ContactId: contact.id || null,
        ContactName: contact.name || contact.phoneNumber,
        DateSendAtUTC: convertToUTCMaintainingTime(
          currentScheduledDate.toISOString()
        ),
        FromPhone: fromPhone,
        InitialData: {},
        IsPrivate: false,
        Message: null,
        OrganizationId: organizationId,
        Params: null,
        PostbackTexts: null,
        Prefix: null,
        TemplateId: null,
        TemplateLabel: null,
        ToPhone: contact.phoneNumber,
      };

      const scheduled = await scheduleMessage(messageData);

      if (scheduled) {
        scheduledMessages.push({
          id: scheduled.id,
          contactName: contact.name,
          phoneNumber: contact.phoneNumber,
          scheduledAt: scheduled.dateSendAtUTC,
        });

        // Log de sucesso
        await logMessageStatus({
          campaignId: bulkSession.id,
          contactId: contact.id || "",
          contactName: contact.name || contact.phoneNumber,
          phoneNumber: contact.phoneNumber,
          scheduledAt: new Date(scheduled.dateSendAtUTC),
          status: "scheduled",
        });
      } else {
        failedMessages.push({
          contactName: contact.name,
          phoneNumber: contact.phoneNumber,
          reason: "Falha ao agendar mensagem",
        });

        // Log de falha
        await logMessageStatus({
          campaignId: bulkSession.id,
          contactId: contact.id || "",
          contactName: contact.name || contact.phoneNumber,
          phoneNumber: contact.phoneNumber,
          scheduledAt: currentScheduledDate,
          status: "failed",
          errorMessage: "Falha ao agendar mensagem",
        });
      }
    }

    // Log da campanha criada
    await logCampaignCreation({
      campaignId: bulkSession.id,
      title,
      status: "created",
      totalContacts: contacts.length,
      scheduledMessages: scheduledMessages.length,
      failedMessages: failedMessages.length,
      startDate: new Date(scheduledDate),
      endDate: currentScheduledDate,
      createdAt: new Date(),
      metadata: {
        botId,
        channelId,
        intervalSeconds,
        exclusiveTagFilter,
        tagIds,
      },
    });

    return res.status(201).json({
      success: true,
      campaign: {
        bulkSessionId: bulkSession.id,
        title,
        botId,
        channelId,
        totalContacts: contacts.length,
        scheduledMessages: scheduledMessages.length,
        failedMessages: failedMessages.length,
        startDate: scheduledDate,
        endDate: currentScheduledDate.toISOString(),
        intervalSeconds,
        exclusiveTagFilter,
        tagIds,
      },
      scheduledMessages,
      failedMessages,
    });
  } catch (error) {
    // Tratamento específico para erros de validação Zod
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Erro de validação",
        details: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }

    console.error("Error in createCampaignController:", error);
    return res.status(500).json({
      error: "Erro interno ao criar campanha",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
