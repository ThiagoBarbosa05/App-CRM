import { db } from "../../db";
import { sql, eq, and } from "drizzle-orm";
import {
  whatsappCampaigns,
  whatsappCampaignMessages,
  whatsappBotSessions,
  campaigns,
  whatsappBots,
  whatsappTemplates,
  users,
  InsertWhatsappCampaign,
  InsertWhatsappCampaignMessage,
} from "@shared/schema";
import type { BotSessionCompletionReason } from "../../services/whatsapp-bot-engine.service";

interface CampaignLog {
  campaignId: string;
  title: string;
  status: "created" | "in_progress" | "completed" | "failed" | "cancelled";
  totalContacts: number;
  scheduledMessages: number;
  failedMessages: number;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

interface MessageLog {
  campaignId: string;
  contactId: string;
  contactName: string;
  phoneNumber: string;
  scheduledAt: Date;
  status: "scheduled" | "sent" | "failed" | "cancelled";
  errorMessage?: string;
}

/**
 * Registra uma nova campanha no sistema
 */
export async function logCampaignCreation(
  campaign: CampaignLog
): Promise<void> {
  try {
    console.log("📊 Campaign Created:", {
      id: campaign.campaignId,
      title: campaign.title,
      totalContacts: campaign.totalContacts,
      scheduledMessages: campaign.scheduledMessages,
      failedMessages: campaign.failedMessages,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate?.toISOString(),
    });

    // Salva campanha no banco de dados
    const metadata = campaign.metadata || {};
    await db.insert(whatsappCampaigns).values({
      id: campaign.campaignId,
      title: campaign.title,
      status: campaign.status,
      totalContacts: campaign.totalContacts,
      scheduledMessages: campaign.scheduledMessages,
      sentMessages: 0,
      failedMessages: campaign.failedMessages,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      botId: metadata.botId || "",
      botTriggerName: metadata.botTriggerName || "Início",
      channelId: metadata.channelId || "",
      fromPhone: metadata.fromPhone || "",
      intervalSeconds: metadata.intervalSeconds || 5,
      exclusiveTagFilter: metadata.exclusiveTagFilter ?? true,
      tagIds: metadata.tagIds || [],
      organizationId: metadata.organizationId || "",
      createdBy: metadata.createdBy,
    });

    console.log("✅ Campaign saved to database");
  } catch (error) {
    console.error("❌ Error logging campaign:", error);
  }
}

/**
 * Registra o progresso de uma mensagem
 */
export async function logMessageStatus(message: MessageLog): Promise<void> {
  try {
    console.log("📧 Message Status:", {
      campaign: message.campaignId,
      contact: message.contactName,
      phone: message.phoneNumber,
      status: message.status,
      scheduledAt: message.scheduledAt.toISOString(),
      error: message.errorMessage,
    });

    // Gera ID único para a mensagem
    const messageId = `${message.campaignId}-${
      message.phoneNumber
    }-${Date.now()}`;

    // Salva mensagem no banco de dados
    await db.insert(whatsappCampaignMessages).values({
      id: messageId,
      campaignId: message.campaignId,
      contactId: message.contactId,
      contactName: message.contactName,
      phoneNumber: message.phoneNumber,
      status: message.status,
      scheduledAt: message.scheduledAt,
      sentAt: message.status === "sent" ? new Date() : null,
      errorMessage: message.errorMessage,
    });

    console.log("✅ Message status saved to database");
  } catch (error) {
    console.error("❌ Error logging message status:", error);
  }
}

/**
 * Atualiza o status de uma campanha
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignLog["status"],
  metadata?: Record<string, any>
): Promise<void> {
  try {
    console.log("🔄 Campaign Status Update:", {
      id: campaignId,
      status,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Atualiza status no banco de dados
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      updateData.completedAt = new Date();
    }

    if (metadata?.sentMessages !== undefined) {
      updateData.sentMessages = metadata.sentMessages;
    }

    if (metadata?.failedMessages !== undefined) {
      updateData.failedMessages = metadata.failedMessages;
    }

    await db
      .update(whatsappCampaigns)
      .set(updateData)
      .where(eq(whatsappCampaigns.id, campaignId));

    console.log("✅ Campaign status updated in database");
  } catch (error) {
    console.error("❌ Error updating campaign status:", error);
  }
}

/**
 * Obtém estatísticas de uma campanha
 */
export async function getCampaignStats(campaignId: string): Promise<{
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  cancelled: number;
} | null> {
  try {
    console.log("📈 Getting stats for campaign:", campaignId);

    // Busca estatísticas do banco de dados
    const messages = await db
      .select()
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.campaignId, campaignId));

    // Contagens por estado terminal/intermediário. "delivered" e "read" são
    // estados posteriores a "sent" (a mensagem saiu), então o funil cumulativo
    // é calculado no frontend.
    const stats = {
      total: messages.length,
      sent: messages.filter((m) => m.status === "sent").length,
      delivered: messages.filter((m) => m.status === "delivered").length,
      read: messages.filter((m) => m.status === "read").length,
      failed: messages.filter((m) => m.status === "failed").length,
      pending: messages.filter((m) => m.status === "scheduled").length,
      cancelled: messages.filter((m) => m.status === "cancelled").length,
    };

    console.log("✅ Stats retrieved from database:", stats);

    return stats;
  } catch (error) {
    console.error("❌ Error getting campaign stats:", error);
    return null;
  }
}

// Rótulos amigáveis dos motivos de finalização de sessão de bot, exibidos no
// bloco "Motivos de finalização dos bots" da página de detalhes da campanha.
const BOT_COMPLETION_REASON_LABELS: Record<BotSessionCompletionReason, string> = {
  end_of_flow: "Chegou no final do fluxo",
  end_conversation: "Atendimento encerrado pelo bot",
  transferred_to_agent: "Transferido para atendente",
  handed_off_to_bot: "Encaminhado para outro bot",
  timed_out: "Sessão expirada por inatividade",
  delivery_failed: "Falha na entrega da mensagem",
  unsupported_node: "Erro: nó não suportado",
};

/**
 * Estatísticas de sessões de bot iniciadas por uma campanha (via
 * whatsapp_bot_sessions.campaign_id). Retorna null quando a campanha não usa
 * bot (nenhuma sessão vinculada) — o frontend usa isso para ocultar os cards
 * "Dos bots" / "Motivos de finalização" em campanhas de template puro.
 */
export async function getCampaignBotStats(campaignId: string): Promise<{
  active: number;
  finished: number;
  reasons: { reason: string; label: string; count: number }[];
} | null> {
  try {
    const rows = await db
      .select({
        status: whatsappBotSessions.status,
        completionReason: whatsappBotSessions.completionReason,
        count: sql<number>`count(*)`,
      })
      .from(whatsappBotSessions)
      .where(eq(whatsappBotSessions.campaignId, campaignId))
      .groupBy(whatsappBotSessions.status, whatsappBotSessions.completionReason);

    if (rows.length === 0) return null;

    let active = 0;
    let finished = 0;
    const reasonCounts = new Map<string, number>();

    for (const row of rows) {
      const count = Number(row.count);
      if (row.status === "active") {
        active += count;
      } else {
        finished += count;
        const reason = row.completionReason ?? "unknown";
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + count);
      }
    }

    const reasons = Array.from(reasonCounts.entries()).map(([reason, count]) => ({
      reason,
      label:
        BOT_COMPLETION_REASON_LABELS[reason as BotSessionCompletionReason] ??
        "Outro motivo",
      count,
    }));

    return { active, finished, reasons };
  } catch (error) {
    console.error("❌ Error getting campaign bot stats:", error);
    return null;
  }
}

/**
 * Lista todas as campanhas
 */
export async function listCampaigns(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const baseQuery = db.select().from(whatsappCampaigns);

    const campaigns = params?.status
      ? await baseQuery
          .where(eq(whatsappCampaigns.status, params.status as any))
          .limit(params?.limit || 50)
          .offset(params?.offset || 0)
          .orderBy(sql`${whatsappCampaigns.createdAt} DESC`)
      : await baseQuery
          .limit(params?.limit || 50)
          .offset(params?.offset || 0)
          .orderBy(sql`${whatsappCampaigns.createdAt} DESC`);

    return campaigns;
  } catch (error) {
    console.error("❌ Error listing campaigns:", error);
    return [];
  }
}

/**
 * Obtém detalhes de uma campanha
 */
export async function getCampaignDetails(campaignId: string) {
  try {
    const [row] = await db
      .select({
        campaign: whatsappCampaigns,
        createdByName: users.name,
        botName: whatsappBots.name,
        templateName: whatsappTemplates.name,
      })
      .from(whatsappCampaigns)
      .leftJoin(users, eq(whatsappCampaigns.createdBy, users.id))
      // `campaigns` compartilha o mesmo id de `whatsappCampaigns` (ambos criados
      // juntos em POST /api/whatsapp/campaigns) e tem waBotId/waTemplateId como
      // FKs reais — diferente de whatsappCampaigns.botId, que é um texto solto.
      .leftJoin(campaigns, eq(campaigns.id, whatsappCampaigns.id))
      .leftJoin(whatsappBots, eq(whatsappBots.id, campaigns.waBotId))
      .leftJoin(whatsappTemplates, eq(whatsappTemplates.id, campaigns.waTemplateId))
      .where(eq(whatsappCampaigns.id, campaignId));

    if (!row) {
      return null;
    }

    const messages = await db
      .select()
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.campaignId, campaignId))
      .orderBy(sql`${whatsappCampaignMessages.scheduledAt} ASC`);

    return {
      ...row.campaign,
      createdByName: row.createdByName ?? null,
      botName: row.botName ?? null,
      templateName: row.templateName ?? null,
      messages,
    };
  } catch (error) {
    console.error("❌ Error getting campaign details:", error);
    return null;
  }
}
