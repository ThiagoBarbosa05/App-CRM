import { db } from "../../db";
import { sql, eq, and } from "drizzle-orm";
import {
  whatsappCampaigns,
  whatsappCampaignMessages,
  InsertWhatsappCampaign,
  InsertWhatsappCampaignMessage,
} from "@shared/schema";

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
    };

    console.log("✅ Stats retrieved from database:", stats);

    return stats;
  } catch (error) {
    console.error("❌ Error getting campaign stats:", error);
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
    const [campaign] = await db
      .select()
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, campaignId));

    if (!campaign) {
      return null;
    }

    const messages = await db
      .select()
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.campaignId, campaignId))
      .orderBy(sql`${whatsappCampaignMessages.scheduledAt} ASC`);

    return {
      ...campaign,
      messages,
    };
  } catch (error) {
    console.error("❌ Error getting campaign details:", error);
    return null;
  }
}
