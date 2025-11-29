import { db } from "../../db";
import { sql, eq, and } from "drizzle-orm";
import {
  umblerCampaigns,
  umblerCampaignMessages,
  InsertUmblerCampaign,
  InsertUmblerCampaignMessage,
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
    await db.insert(umblerCampaigns).values({
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
    await db.insert(umblerCampaignMessages).values({
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
      .update(umblerCampaigns)
      .set(updateData)
      .where(eq(umblerCampaigns.id, campaignId));

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
  failed: number;
  pending: number;
} | null> {
  try {
    console.log("📈 Getting stats for campaign:", campaignId);

    // Busca estatísticas do banco de dados
    const messages = await db
      .select()
      .from(umblerCampaignMessages)
      .where(eq(umblerCampaignMessages.campaignId, campaignId));

    const stats = {
      total: messages.length,
      sent: messages.filter((m) => m.status === "sent").length,
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
    const baseQuery = db.select().from(umblerCampaigns);

    const campaigns = params?.status
      ? await baseQuery
          .where(eq(umblerCampaigns.status, params.status as any))
          .limit(params?.limit || 50)
          .offset(params?.offset || 0)
          .orderBy(sql`${umblerCampaigns.createdAt} DESC`)
      : await baseQuery
          .limit(params?.limit || 50)
          .offset(params?.offset || 0)
          .orderBy(sql`${umblerCampaigns.createdAt} DESC`);

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
      .from(umblerCampaigns)
      .where(eq(umblerCampaigns.id, campaignId));

    if (!campaign) {
      return null;
    }

    const messages = await db
      .select()
      .from(umblerCampaignMessages)
      .where(eq(umblerCampaignMessages.campaignId, campaignId))
      .orderBy(sql`${umblerCampaignMessages.scheduledAt} ASC`);

    return {
      ...campaign,
      messages,
    };
  } catch (error) {
    console.error("❌ Error getting campaign details:", error);
    return null;
  }
}
