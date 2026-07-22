import { db } from "../../db";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  whatsappBotSessions,
  whatsappBots,
  whatsappChannels,
  whatsappConversations,
  clients,
} from "@shared/schema";
import type { BotSessionCompletionReason } from "../../services/whatsapp-bot-engine.service";
import { normalizePhone } from "../../services/whatsapp-conversations.service";
import { BOT_COMPLETION_REASON_LABELS } from "../campaigns/campaign-logger";

export const BOT_SESSION_STATUS_LABELS = {
  active: "Em execução",
  completed: "Finalizado",
  timed_out: "Expirado",
  failed: "Erro",
} as const;

const querySchema = z.object({
  botIds: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.enum(["active", "completed", "timed_out", "failed"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type BotSessionHistoryFilters = ReturnType<typeof parseBotSessionHistoryQuery>;

export function parseBotSessionHistoryQuery(query: Record<string, unknown>) {
  const parsed = querySchema.parse(query);
  return {
    ...parsed,
    botIds: parsed.botIds
      ? Array.isArray(parsed.botIds)
        ? parsed.botIds
        : [parsed.botIds]
      : undefined,
  };
}

export interface BotDispatchHistoryRow {
  id: string;
  botId: string;
  botName: string;
  phoneNumber: string;
  clientName: string | null;
  status: "active" | "completed" | "timed_out" | "failed";
  statusLabel: string;
  completionReason: string | null;
  completionReasonLabel: string | null;
  errorMessage: string | null;
  channelId: number | null;
  channelName: string | null;
  channelProvider: string | null;
  conversationId: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Lista paginada de disparos de bot (manuais + campanha), com nome do bot,
 * canal usado no disparo e conversa vinculada, para a tela de histórico.
 * Disparos que nem chegaram a criar sessão (already_active, no_start_node,
 * opted_out) não têm linha em whatsapp_bot_sessions e por isso não aparecem
 * aqui — limitação aceita, não há o que "listar" para esses casos.
 */
export async function listBotDispatchHistory(
  filters: BotSessionHistoryFilters,
): Promise<{ rows: BotDispatchHistoryRow[]; total: number; page: number; pageSize: number }> {
  const conditions = [
    filters.botIds?.length ? inArray(whatsappBotSessions.botId, filters.botIds) : undefined,
    filters.status ? eq(whatsappBotSessions.status, filters.status) : undefined,
    filters.dateFrom ? gte(whatsappBotSessions.startedAt, new Date(filters.dateFrom)) : undefined,
    filters.dateTo ? lte(whatsappBotSessions.startedAt, new Date(filters.dateTo)) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  const where = conditions.length ? and(...conditions) : undefined;

  const [sessionRows, [{ total }]] = await Promise.all([
    db
      .select({
        id: whatsappBotSessions.id,
        botId: whatsappBotSessions.botId,
        botName: whatsappBots.name,
        phoneNumber: whatsappBotSessions.phoneNumber,
        status: whatsappBotSessions.status,
        completionReason: whatsappBotSessions.completionReason,
        errorMessage: whatsappBotSessions.errorMessage,
        channelId: whatsappBotSessions.channelId,
        channelName: whatsappChannels.name,
        channelProvider: whatsappChannels.provider,
        startedAt: whatsappBotSessions.startedAt,
        completedAt: whatsappBotSessions.completedAt,
      })
      .from(whatsappBotSessions)
      .leftJoin(whatsappBots, eq(whatsappBots.id, whatsappBotSessions.botId))
      .leftJoin(whatsappChannels, eq(whatsappChannels.id, whatsappBotSessions.channelId))
      .where(where)
      .orderBy(desc(whatsappBotSessions.startedAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ total: count() })
      .from(whatsappBotSessions)
      .where(where),
  ]);

  if (sessionRows.length === 0) {
    return { rows: [], total: Number(total), page: filters.page, pageSize: filters.pageSize };
  }

  // Resolve conversa/cliente/canal-fallback por telefone (normalizado por
  // dígitos, mesmo padrão de findOrCreateConversation).
  const digitsList = Array.from(
    new Set(sessionRows.map((r) => normalizePhone(r.phoneNumber).digits)),
  );
  const convRows = await db
    .select({
      id: whatsappConversations.id,
      phone: whatsappConversations.phone,
      clientId: whatsappConversations.clientId,
      channelId: whatsappConversations.channelId,
    })
    .from(whatsappConversations)
    .where(
      inArray(
        sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g')`,
        digitsList,
      ),
    );

  const convByDigits = new Map(convRows.map((c) => [normalizePhone(c.phone).digits, c]));

  const clientIds = Array.from(
    new Set(convRows.map((c) => c.clientId).filter((id): id is string => !!id)),
  );
  const clientRows = clientIds.length
    ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds))
    : [];
  const clientNameById = new Map(clientRows.map((c) => [c.id, c.name]));

  // Canais resolvidos em batch para o fallback de sessões sem channelId
  // próprio (linhas anteriores à migração).
  const fallbackChannelIds = Array.from(
    new Set(
      sessionRows
        .filter((r) => !r.channelId)
        .map((r) => convByDigits.get(normalizePhone(r.phoneNumber).digits)?.channelId)
        .filter((id): id is number => !!id),
    ),
  );
  const fallbackChannels = fallbackChannelIds.length
    ? await db
        .select({ id: whatsappChannels.id, name: whatsappChannels.name, provider: whatsappChannels.provider })
        .from(whatsappChannels)
        .where(inArray(whatsappChannels.id, fallbackChannelIds))
    : [];
  const fallbackChannelById = new Map(fallbackChannels.map((c) => [c.id, c]));

  const rows: BotDispatchHistoryRow[] = sessionRows.map((r) => {
    const conv = convByDigits.get(normalizePhone(r.phoneNumber).digits) ?? null;
    const fallbackChannel = !r.channelId && conv?.channelId ? fallbackChannelById.get(conv.channelId) : null;
    const reason = r.completionReason as BotSessionCompletionReason | null;
    return {
      id: r.id,
      botId: r.botId,
      botName: r.botName ?? "Bot",
      phoneNumber: r.phoneNumber,
      clientName: conv?.clientId ? clientNameById.get(conv.clientId) ?? null : null,
      status: r.status,
      statusLabel: BOT_SESSION_STATUS_LABELS[r.status],
      completionReason: r.completionReason,
      completionReasonLabel: reason ? BOT_COMPLETION_REASON_LABELS[reason] ?? "Outro motivo" : null,
      errorMessage: r.errorMessage,
      channelId: r.channelId ?? fallbackChannel?.id ?? null,
      channelName: r.channelName ?? fallbackChannel?.name ?? null,
      channelProvider: r.channelProvider ?? fallbackChannel?.provider ?? null,
      conversationId: conv?.id ?? null,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    };
  });

  return { rows, total: Number(total), page: filters.page, pageSize: filters.pageSize };
}
