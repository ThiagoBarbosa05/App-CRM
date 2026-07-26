import { db } from "../../db";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  whatsappMessages,
  whatsappConversations,
  whatsappChannels,
  whatsappCampaignMessages,
  whatsappCampaigns,
  clients,
  users,
} from "@shared/schema";

const querySchema = z.object({
  direction: z.enum(["inbound", "outbound"]).optional(),
  status: z.enum(["sent", "delivered", "read", "failed"]).optional(),
  origin: z.enum(["manual", "campaign"]).optional(),
  channelIds: z.union([z.string(), z.array(z.string())]).optional(),
  search: z.string().trim().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type MessageLogFilters = ReturnType<typeof parseMessageLogQuery>;

export function parseMessageLogQuery(query: Record<string, unknown>) {
  const parsed = querySchema.parse(query);
  const channelIdsRaw = parsed.channelIds
    ? Array.isArray(parsed.channelIds)
      ? parsed.channelIds
      : [parsed.channelIds]
    : undefined;
  const channelIds = channelIdsRaw
    ?.map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  return {
    ...parsed,
    channelIds: channelIds?.length ? channelIds : undefined,
  };
}

export interface WhatsappMessageLogRow {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  content: string | null;
  caption: string | null;
  status: "sent" | "delivered" | "read" | "failed" | null;
  statusReason: string | null;
  conversationId: string;
  contactPhone: string;
  contactName: string | null;
  clientId: string | null;
  clientName: string | null;
  channelId: number | null;
  channelName: string | null;
  channelProvider: string | null;
  channelDisplayPhone: string | null;
  sentByUserId: string | null;
  sentByUserName: string | null;
  campaignMessageId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  effectiveAt: Date;
  createdAt: Date;
}

export interface WhatsappMessageLogResult {
  rows: WhatsappMessageLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Lista paginada e filtrável de mensagens de WhatsApp (enviadas e recebidas)
 * através de todas as conversas/canais, para rastreio de erros de envio e
 * identificação de remetente/destinatário. Diferente do histórico de bots,
 * não precisa de casamento por telefone normalizado — conversationId/channelId
 * já são FKs diretas em whatsapp_messages.
 */
export async function listWhatsappMessageLog(
  filters: MessageLogFilters,
): Promise<WhatsappMessageLogResult> {
  const effectiveAt = sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`;

  const conditions = [
    filters.direction ? eq(whatsappMessages.direction, filters.direction) : undefined,
    filters.status ? eq(whatsappMessages.status, filters.status) : undefined,
    filters.channelIds?.length ? inArray(whatsappMessages.channelId, filters.channelIds) : undefined,
    filters.origin === "campaign" ? sql`${whatsappMessages.campaignMessageId} IS NOT NULL` : undefined,
    filters.origin === "manual" ? sql`${whatsappMessages.campaignMessageId} IS NULL` : undefined,
    filters.dateFrom ? gte(effectiveAt, new Date(filters.dateFrom)) : undefined,
    filters.dateTo ? lte(effectiveAt, new Date(filters.dateTo)) : undefined,
    filters.search
      ? or(
          ilike(whatsappConversations.phone, `%${filters.search}%`),
          ilike(whatsappConversations.contactName, `%${filters.search}%`),
          ilike(clients.name, `%${filters.search}%`),
          ilike(whatsappChannels.name, `%${filters.search}%`),
          ilike(whatsappChannels.displayPhone, `%${filters.search}%`),
        )
      : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: whatsappMessages.id,
        direction: whatsappMessages.direction,
        type: whatsappMessages.type,
        content: whatsappMessages.content,
        caption: whatsappMessages.caption,
        status: whatsappMessages.status,
        statusReason: whatsappMessages.statusReason,
        conversationId: whatsappMessages.conversationId,
        contactPhone: whatsappConversations.phone,
        contactName: whatsappConversations.contactName,
        clientId: whatsappConversations.clientId,
        clientName: clients.name,
        channelId: whatsappMessages.channelId,
        channelName: whatsappChannels.name,
        channelProvider: whatsappChannels.provider,
        channelDisplayPhone: whatsappChannels.displayPhone,
        sentByUserId: whatsappMessages.sentByUserId,
        sentByUserName: users.name,
        campaignMessageId: whatsappMessages.campaignMessageId,
        campaignId: whatsappCampaigns.id,
        campaignName: whatsappCampaigns.title,
        effectiveAt,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .innerJoin(whatsappConversations, eq(whatsappConversations.id, whatsappMessages.conversationId))
      .leftJoin(whatsappChannels, eq(whatsappChannels.id, whatsappMessages.channelId))
      .leftJoin(clients, eq(clients.id, whatsappConversations.clientId))
      .leftJoin(users, eq(users.id, whatsappMessages.sentByUserId))
      .leftJoin(whatsappCampaignMessages, eq(whatsappCampaignMessages.id, whatsappMessages.campaignMessageId))
      .leftJoin(whatsappCampaigns, eq(whatsappCampaigns.id, whatsappCampaignMessages.campaignId))
      .where(where)
      .orderBy(desc(effectiveAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ total: count() })
      .from(whatsappMessages)
      .innerJoin(whatsappConversations, eq(whatsappConversations.id, whatsappMessages.conversationId))
      .leftJoin(whatsappChannels, eq(whatsappChannels.id, whatsappMessages.channelId))
      .leftJoin(clients, eq(clients.id, whatsappConversations.clientId))
      .where(where),
  ]);

  return { rows, total: Number(total), page: filters.page, pageSize: filters.pageSize };
}
