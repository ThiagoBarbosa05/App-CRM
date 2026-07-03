import { db } from "../db";
import {
  clients,
  whatsappChannels,
  whatsappConversations,
  whatsappMessages,
  whatsappMedia,
  whatsappConversationReads,
  whatsappReactions,
  waSavedStickers,
  waQuickReplies,
  contactTags,
  tags,
  whatsappTags,
} from "../../shared/schema";
import { eq, and, ilike, or, desc, sql, asc, inArray, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { sendTextMessage, sendTemplateMessage, uploadMedia, sendMediaMessage, sendReaction, downloadMediaToBuffer } from "../integrations/whatsapp";
import { sendText as evoSendText, sendMedia as evoSendMedia, normalizeToJid } from "../integrations/evolution";
import { uploadWhatsappMedia, getPublicR2Url } from "../lib/r2";
import { getTemplateMedia, fetchMetaTemplates } from "./whatsapp-templates.service";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { getChannelByUserId, getChannelById, getChannelForConversation, resolveChannelById, resolveChannelForConversation } from "./whatsapp-channels.service";
import type { ResolvedChannel } from "./whatsapp-channels.service";
import { remuxWebmOpusToOgg } from "../lib/webm-opus-to-ogg";
import { Cursor, clampLimit, encodeCursor } from "../lib/cursor-pagination";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return { digits, withoutCountry };
}

export async function findOrCreateConversation(phone: string, channelId?: number | null) {
  const { digits, withoutCountry } = normalizePhone(phone);

  const phoneCondition = or(
    sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${digits}`,
    sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${withoutCountry}`,
  );

  // Conversa é UMA por cliente/telefone, independente do canal. O channelId
  // recebido representa apenas o "último canal usado" (gravado abaixo).
  const [existing] = await db
    .select()
    .from(whatsappConversations)
    .where(phoneCondition)
    .orderBy(asc(whatsappConversations.createdAt))
    .limit(1);

  if (existing) return existing;

  const [matchedClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      or(
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') = ${digits}`,
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') = ${withoutCountry}`,
        sql`'55' || regexp_replace(${clients.phone}, '\\D', '', 'g') = ${digits}`,
      ),
    )
    .limit(1);

  const [created] = await db
    .insert(whatsappConversations)
    .values({ phone, clientId: matchedClient?.id ?? null, channelId: channelId ?? null })
    .returning();

  return created;
}

// Resolve o canal de envio de uma conversa. Se channelId for fornecido (override
// manual de admin), usa esse canal e o grava como último canal da conversa.
// Caso contrário, usa o último canal por onde o cliente escreveu (conversa).
async function resolveOutboundChannel(
  conversationId: string,
  channelId?: number,
): Promise<ResolvedChannel | null> {
  if (channelId != null) {
    const ch = await resolveChannelById(channelId).catch(() => null);
    if (ch) {
      await db
        .update(whatsappConversations)
        .set({ channelId })
        .where(eq(whatsappConversations.id, conversationId));
      return ch;
    }
  }
  return resolveChannelForConversation(conversationId).catch(() => null);
}

export async function resolveConversationIdByClientId(clientId: string) {
  const [conv] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.clientId, clientId))
    .orderBy(desc(whatsappConversations.lastMessageAt))
    .limit(1);
  return conv?.id ?? null;
}

// Aceita clientId OU conversationId diretamente (para contatos desconhecidos).
export async function resolveConversationId(clientIdOrConvId: string): Promise<string | null> {
  const byClient = await resolveConversationIdByClientId(clientIdOrConvId);
  if (byClient) return byClient;

  const [conv] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, clientIdOrConvId))
    .limit(1);
  return conv?.id ?? null;
}

export async function linkClientToConversation(conversationId: string, clientId: string) {
  const [updated] = await db
    .update(whatsappConversations)
    .set({ clientId, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))
    .returning();
  return updated ?? null;
}

export async function transferConversation(conversationId: string, targetChannelId: number) {
  // Transferir para um canal = entregar ao atendente dono desse canal, com o
  // canal vinculado. Assim a conversa passa a aparecer no inbox dele.
  const [channel] = await db
    .select({ userId: whatsappChannels.userId })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, targetChannelId))
    .limit(1);

  const [updated] = await db
    .update(whatsappConversations)
    .set({ channelId: targetChannelId, assignedAgentId: channel?.userId ?? null, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))
    .returning();
  return updated ?? null;
}

export async function getConversationPhone(conversationId: string): Promise<string | null> {
  const [conv] = await db
    .select({ phone: whatsappConversations.phone })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);
  return conv?.phone ?? null;
}

export async function listSavedStickers(userId: string) {
  return db
    .select({
      id: waSavedStickers.id,
      mediaId: waSavedStickers.mediaId,
      createdAt: waSavedStickers.createdAt,
      storageKey: whatsappMedia.storageKey,
      mimeType: whatsappMedia.mimeType,
    })
    .from(waSavedStickers)
    .innerJoin(whatsappMedia, eq(waSavedStickers.mediaId, whatsappMedia.id))
    .where(eq(waSavedStickers.userId, userId))
    .orderBy(desc(waSavedStickers.createdAt));
}

export async function saveSticker(userId: string, mediaId: string) {
  const [row] = await db
    .insert(waSavedStickers)
    .values({ userId, mediaId })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function deleteSavedSticker(userId: string, stickerId: string) {
  const [row] = await db
    .delete(waSavedStickers)
    .where(and(eq(waSavedStickers.id, stickerId), eq(waSavedStickers.userId, userId)))
    .returning();
  return row ?? null;
}

export async function isStickerSaved(userId: string, mediaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: waSavedStickers.id })
    .from(waSavedStickers)
    .where(and(eq(waSavedStickers.userId, userId), eq(waSavedStickers.mediaId, mediaId)))
    .limit(1);
  return !!row;
}

// ── Respostas rápidas ────────────────────────────────────────────────────────

export async function listQuickReplies(userId: string) {
  return db
    .select({
      id: waQuickReplies.id,
      title: waQuickReplies.title,
      content: waQuickReplies.content,
      createdAt: waQuickReplies.createdAt,
    })
    .from(waQuickReplies)
    .where(eq(waQuickReplies.userId, userId))
    .orderBy(asc(waQuickReplies.title));
}

export async function createQuickReply(userId: string, title: string, content: string) {
  const [row] = await db
    .insert(waQuickReplies)
    .values({ userId, title, content })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function deleteQuickReply(userId: string, id: string) {
  const [row] = await db
    .delete(waQuickReplies)
    .where(and(eq(waQuickReplies.id, id), eq(waQuickReplies.userId, userId)))
    .returning();
  return row ?? null;
}

export async function listWhatsappTagsForFilter() {
  return db
    .select({ id: whatsappTags.id, name: whatsappTags.name, emoji: whatsappTags.emoji, color: whatsappTags.color })
    .from(whatsappTags)
    .orderBy(whatsappTags.name);
}

export async function listClientsForChat(
  userId: string,
  userRole: string,
  search?: string,
  whatsappTagIds?: string[],
) {
  // .mapWith aplica o mapper de timestamp do Drizzle ao SQL cru — sem ele o
  // valor chega ao cliente como string sem fuso ("2026-07-02 23:16:00") e o
  // browser a interpreta como hora local, exibindo o horário UTC (+3h em SP).
  const effectiveAt = sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`
    .mapWith(whatsappMessages.sentAt)
    .as("last_at");

  const readsSub = db.$with("reads").as(
    db
      .select({
        conversationId: whatsappConversationReads.conversationId,
        lastReadAt: whatsappConversationReads.lastReadAt,
      })
      .from(whatsappConversationReads)
      .where(eq(whatsappConversationReads.userId, userId)),
  );

  const unreadSub = db.$with("unread").as(
    db
      .select({
        conversationId: whatsappMessages.conversationId,
        unreadCount: sql<number>`cast(count(*) as int)`.as("unread_count"),
      })
      .from(whatsappMessages)
      .leftJoin(readsSub, eq(whatsappMessages.conversationId, readsSub.conversationId))
      .where(
        and(
          eq(whatsappMessages.direction, "inbound"),
          sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt}) > COALESCE(${readsSub.lastReadAt}, '1970-01-01'::timestamp)`,
        ),
      )
      .groupBy(whatsappMessages.conversationId),
  );

  const lastMsgSub = db.$with("last_msg").as(
    db
      .selectDistinctOn([whatsappMessages.conversationId], {
        conversationId: whatsappMessages.conversationId,
        lastAt: effectiveAt,
        lastContent: sql<string | null>`
          CASE ${whatsappMessages.type}
            WHEN 'image'    THEN COALESCE('📷 ' || ${whatsappMessages.caption}, '📷 Imagem')
            WHEN 'document' THEN COALESCE('📄 ' || ${whatsappMessages.caption}, '📄 Documento')
            WHEN 'video'    THEN COALESCE('🎥 ' || ${whatsappMessages.caption}, '🎥 Vídeo')
            WHEN 'audio'    THEN '🎵 Áudio'
            WHEN 'sticker'  THEN '🎭 Figurinha'
            ELSE ${whatsappMessages.content}
          END
        `.as("last_content"),
        lastDirection: whatsappMessages.direction,
        lastType: whatsappMessages.type,
      })
      .from(whatsappMessages)
      .orderBy(whatsappMessages.conversationId, desc(effectiveAt)),
  );

  const conditions: ReturnType<typeof eq>[] = [];

  // Conversa é unificada por cliente; o vendedor vê as conversas atribuídas a ele
  // (assignedAgentId) e, quando não há atribuição, as dos clientes sob sua
  // responsabilidade. Ao transferir, a conversa passa a aparecer só para o
  // atendente atribuído; o responsável anterior deixa de vê-la.
  if (userRole === "vendedor" && userId) {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) conditions.push(scope);
  }

  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(whatsappConversations.phone, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  if (whatsappTagIds && whatsappTagIds.length > 0) {
    const realTagIds = whatsappTagIds.filter((id) => id !== "__none__");
    const includeNone = whatsappTagIds.includes("__none__");

    if (realTagIds.length > 0 && includeNone) {
      // OR: tem uma das tags selecionadas OU não tem nenhuma tag
      const taggedSub = db
        .selectDistinct({ clientId: contactTags.clientId })
        .from(contactTags)
        .where(inArray(contactTags.whatsappTagId, realTagIds));
      const noTagSub = db
        .selectDistinct({ clientId: contactTags.clientId })
        .from(contactTags)
        .where(sql`${contactTags.whatsappTagId} IS NOT NULL`);
      conditions.push(
        or(
          inArray(whatsappConversations.clientId, taggedSub),
          sql`${whatsappConversations.clientId} IS NOT NULL AND ${whatsappConversations.clientId} NOT IN (${noTagSub})`,
          sql`${whatsappConversations.clientId} IS NULL`,
        ) as unknown as ReturnType<typeof eq>,
      );
    } else if (realTagIds.length > 0) {
      const taggedClientIds = db
        .selectDistinct({ clientId: contactTags.clientId })
        .from(contactTags)
        .where(inArray(contactTags.whatsappTagId, realTagIds));
      conditions.push(
        inArray(whatsappConversations.clientId, taggedClientIds) as unknown as ReturnType<typeof eq>,
      );
    } else if (includeNone) {
      // Apenas "sem etiqueta": clientId null OU clientId sem nenhuma wa tag
      const withTagSub = db
        .selectDistinct({ clientId: contactTags.clientId })
        .from(contactTags)
        .where(sql`${contactTags.whatsappTagId} IS NOT NULL`);
      conditions.push(
        or(
          sql`${whatsappConversations.clientId} IS NULL`,
          sql`${whatsappConversations.clientId} IS NOT NULL AND ${whatsappConversations.clientId} NOT IN (${withTagSub})`,
        ) as unknown as ReturnType<typeof eq>,
      );
    }
  }

  const rows = await db
    .with(readsSub, unreadSub, lastMsgSub)
    .select({
      conversationId: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
      clientName: clients.name,
      lastMessageAt: lastMsgSub.lastAt,
      lastMessageContent: lastMsgSub.lastContent,
      lastMessageDirection: lastMsgSub.lastDirection,
      lastMessageType: lastMsgSub.lastType,
      unreadCount: sql<number>`coalesce(${unreadSub.unreadCount}, 0)`,
      channelId: whatsappConversations.channelId,
      channelName: whatsappChannels.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .leftJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .leftJoin(lastMsgSub, eq(whatsappConversations.id, lastMsgSub.conversationId))
    .leftJoin(unreadSub, eq(whatsappConversations.id, unreadSub.conversationId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${lastMsgSub.lastAt} DESC NULLS LAST`)
    .limit(100);

  const clientIds = rows.map((r) => r.clientId).filter((id): id is string => !!id);

  const tagsByClient = new Map<string, { id: string; name: string; color: string | null; type: string }[]>();
  const whatsappTagsByClient = new Map<string, { id: string; name: string; emoji: string | null; color: string | null }[]>();

  if (clientIds.length > 0) {
    const tagsData = await db
      .select({
        clientId: contactTags.clientId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
        type: tags.type,
      })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(inArray(contactTags.clientId, clientIds));

    for (const row of tagsData) {
      if (!row.clientId) continue;
      const list = tagsByClient.get(row.clientId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color, type: row.type });
      tagsByClient.set(row.clientId, list);
    }

    const waTagsData = await db
      .select({
        clientId: contactTags.clientId,
        id: whatsappTags.id,
        name: whatsappTags.name,
        emoji: whatsappTags.emoji,
        color: whatsappTags.color,
      })
      .from(contactTags)
      .innerJoin(whatsappTags, eq(contactTags.whatsappTagId, whatsappTags.id))
      .where(inArray(contactTags.clientId, clientIds));

    for (const row of waTagsData) {
      if (!row.clientId) continue;
      const list = whatsappTagsByClient.get(row.clientId) ?? [];
      list.push({ id: row.id, name: row.name, emoji: row.emoji, color: row.color });
      whatsappTagsByClient.set(row.clientId, list);
    }
  }

  return rows.map((row) => ({
    ...row,
    tags: row.clientId ? (tagsByClient.get(row.clientId) ?? []) : [],
    whatsappTags: row.clientId ? (whatsappTagsByClient.get(row.clientId) ?? []) : [],
  }));
}

export async function getConversation(
  conversationId: string,
  userId: string,
  userRole: string,
  pagination: { cursor?: Cursor | null; limit?: number } = {},
) {
  const limit = clampLimit(pagination.limit, { fallback: 20, max: 50 });
  const cursor = pagination.cursor ?? null;

  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) return null;

  const replyMsg = alias(whatsappMessages, "reply_msg");
  const effectiveAt = sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`;

  const messageConditions: ReturnType<typeof eq>[] = [
    eq(whatsappMessages.conversationId, conversationId),
  ];
  if (cursor) {
    messageConditions.push(
      sql`(${effectiveAt}, ${whatsappMessages.id}) < (${cursor.at}::timestamp, ${cursor.id})` as unknown as ReturnType<typeof eq>,
    );
  }

  const rawMessages = await db
    .select({
      id: whatsappMessages.id,
      conversationId: whatsappMessages.conversationId,
      waMessageId: whatsappMessages.waMessageId,
      direction: whatsappMessages.direction,
      type: whatsappMessages.type,
      content: whatsappMessages.content,
      caption: whatsappMessages.caption,
      status: whatsappMessages.status,
      replyToMessageId: whatsappMessages.replyToMessageId,
      sentByUserId: whatsappMessages.sentByUserId,
      campaignMessageId: whatsappMessages.campaignMessageId,
      sentAt: whatsappMessages.sentAt,
      createdAt: whatsappMessages.createdAt,
      replyToContent: replyMsg.content,
      replyToType: replyMsg.type,
      replyToDirection: replyMsg.direction,
      channelId: whatsappMessages.channelId,
      channelName: whatsappChannels.name,
      channelProvider: whatsappChannels.provider,
      rawPayload: whatsappMessages.rawPayload,
      media: {
        id: whatsappMedia.id,
        whatsappMediaId: whatsappMedia.whatsappMediaId,
        storageKey: whatsappMedia.storageKey,
        mimeType: whatsappMedia.mimeType,
        filename: whatsappMedia.filename,
        size: whatsappMedia.size,
      },
    })
    .from(whatsappMessages)
    .leftJoin(whatsappMedia, eq(whatsappMessages.id, whatsappMedia.messageId))
    .leftJoin(replyMsg, eq(whatsappMessages.replyToMessageId, replyMsg.id))
    .leftJoin(whatsappChannels, eq(whatsappMessages.channelId, whatsappChannels.id))
    .where(and(...messageConditions))
    .orderBy(desc(effectiveAt), desc(whatsappMessages.id))
    .limit(limit + 1);

  const hasMore = rawMessages.length > limit;
  const pageRows = rawMessages.slice(0, limit);
  const oldestInPage = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && oldestInPage
      ? encodeCursor({
          at: (oldestInPage.sentAt ?? oldestInPage.createdAt).toISOString(),
          id: oldestInPage.id,
        })
      : null;

  pageRows.reverse();

  const messageIds = pageRows.map((m) => m.id);
  const reactionsRows = messageIds.length > 0
    ? await db
        .select({
          messageId: whatsappReactions.messageId,
          emoji: whatsappReactions.emoji,
          direction: whatsappReactions.direction,
        })
        .from(whatsappReactions)
        .where(inArray(whatsappReactions.messageId, messageIds))
    : [];

  const reactionsByMessage = new Map<string, { emoji: string; direction: "inbound" | "outbound" }[]>();
  for (const r of reactionsRows) {
    if (!r.emoji) continue;
    const list = reactionsByMessage.get(r.messageId) ?? [];
    list.push({ emoji: r.emoji, direction: r.direction as "inbound" | "outbound" });
    reactionsByMessage.set(r.messageId, list);
  }

  const messages = pageRows.map((m) => ({
    ...m,
    reactions: reactionsByMessage.get(m.id) ?? [],
  }));

  return { conversation: conv, messages, nextCursor };
}

export async function sendConversationMessage(
  conversationId: string,
  message: string,
  userId: string,
  userRole: string,
  channelId?: number,
  replyToMessageId?: string,
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
      phone: whatsappConversations.phone,
      clientId: whatsappConversations.clientId,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) {
    console.warn(
      `[WA Conversations Service] Conversa ${conversationId} não encontrada ou sem permissão para usuário ${userId} (${userRole})`,
    );
    return null;
  }

  // Resolve waMessageId da mensagem citada (necessário para o context da Meta API)
  let replyToWaMessageId: string | null = null;
  if (replyToMessageId) {
    const [ref] = await db
      .select({ waMessageId: whatsappMessages.waMessageId })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.id, replyToMessageId))
      .limit(1);
    replyToWaMessageId = ref?.waMessageId ?? null;
  }

  // Resolve o canal de envio: override explícito (admin) tem prioridade; senão
  // usa o último canal da conversa (por onde o cliente escreveu por último).
  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId);

  // Persiste a mensagem imediatamente como "failed" — atualiza para "sent" se a API responder ok
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      channelId: resolvedChannel?.id ?? null,
      direction: "outbound",
      type: "text",
      content: message,
      status: "failed",
      sentByUserId: userId,
      sentAt: new Date(),
      replyToMessageId: replyToMessageId ?? null,
    })
    .returning({ id: whatsappMessages.id });

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  try {
    let waMessageId: string | null = null;

    if (resolvedChannel?.provider === "evolution") {
      const evoResult = await evoSendText(
        resolvedChannel.evolutionInstanceName,
        conv.phone,
        message,
        { quotedMsgId: replyToWaMessageId ?? undefined },
      );
      waMessageId = evoResult?.key?.id ?? null;
    } else {
      const cloudOverride = resolvedChannel?.provider === "cloud_api"
        ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
        : null;
      const result = await sendTextMessage(conv.phone, message, cloudOverride ?? undefined, replyToWaMessageId ?? undefined);
      waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
    }

    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId })
      .where(eq(whatsappMessages.id, savedMessage.id));

    // Publica o evento SSE somente após o status "sent" estar gravado no banco,
    // evitando que o frontend refaça a query e veja status "failed" prematuramente
    if (conv.id) {
      publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return { waMessageId };
  } catch (err) {
    console.error(`[WA Conversations Service] Erro no envio:`, err);
    throw err;
  }
}

/**
 * Envia um template aprovado da Meta para a conversa. Diferente do texto livre,
 * o template é o único formato permitido fora da janela de 24h e só pode sair
 * pelo canal oficial (cloud_api) — o Evolution (não oficial) não tem templates.
 */
export async function sendConversationTemplate(
  conversationId: string,
  userId: string,
  userRole: string,
  templateName: string,
  languageCode: string,
  bodyParams: { name?: string; value: string }[] | undefined,
  previewText: string | undefined,
  channelId?: number,
  headerMedia?: { storageKey: string; mediaType: "image" | "video" | "document" },
  parameterFormat?: "NAMED" | "POSITIONAL",
  templateButtons?: { type: string; text: string }[],
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
      phone: whatsappConversations.phone,
      clientId: whatsappConversations.clientId,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) {
    console.warn(
      `[WA Conversations Service] Conversa ${conversationId} não encontrada ou sem permissão para usuário ${userId} (${userRole})`,
    );
    return null;
  }

  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId);

  // Templates oficiais só existem no canal cloud_api (API da Meta).
  if (resolvedChannel?.provider !== "cloud_api") {
    throw new Error(
      "Templates só podem ser enviados pelo canal oficial do WhatsApp (Cloud API).",
    );
  }

  // Inclui parameter_name somente quando o template usa formato NAMED explicitamente.
  // Para POSITIONAL (o mais comum) ou quando format não foi informado, usa só "text".
  const bodyParameters = (bodyParams ?? []).map((p) =>
    parameterFormat === "NAMED" && p.name
      ? { type: "text", parameter_name: p.name, text: p.value }
      : { type: "text", text: p.value },
  );

  // Cabeçalho: prioriza a mídia escolhida no envio (biblioteca de mídia); na
  // ausência dela, usa a mídia padrão configurada para o template. Em ambos os
  // casos é enviada como link público do R2, que a Meta consegue baixar.
  const resolvedHeaderMedia =
    headerMedia ?? (await getTemplateMedia(templateName, languageCode));

  const componentsArr: object[] = [];
  if (resolvedHeaderMedia) {
    componentsArr.push({
      type: "header",
      parameters: [
        {
          type: resolvedHeaderMedia.mediaType,
          [resolvedHeaderMedia.mediaType]: {
            link: getPublicR2Url(resolvedHeaderMedia.storageKey),
          },
        },
      ],
    });
  }
  if (bodyParameters.length > 0) {
    componentsArr.push({ type: "body", parameters: bodyParameters });
  }
  const components = componentsArr.length > 0 ? componentsArr : undefined;

  // Persiste imediatamente como "failed" — atualiza para "sent" se a API responder ok.
  // rawPayload guarda os components montados para que o retry possa reenviar o template.
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      channelId: resolvedChannel.id,
      direction: "outbound",
      type: "template",
      content: previewText ?? templateName,
      status: "failed",
      sentByUserId: userId,
      sentAt: new Date(),
      rawPayload: {
        kind: "conversation_template",
        templateName,
        language: languageCode,
        components: componentsArr,
        buttons: templateButtons ?? [],
      },
    })
    .returning({ id: whatsappMessages.id });

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  try {
    const cloudOverride = {
      phoneNumberId: resolvedChannel.phoneNumberId,
      accessToken: resolvedChannel.accessToken,
    };

    console.log(`[sendConversationTemplate] template="${templateName}" lang="${languageCode}" parameterFormat="${parameterFormat ?? "não informado"}" phone="${conv.phone}"`);
    console.log(`[sendConversationTemplate] components enviados à Meta:`, JSON.stringify(components, null, 2));

    // Busca os componentes completos do template (inclui botões) para diagnóstico.
    const allMetaTemplates = await fetchMetaTemplates().catch(() => []);
    const metaTpl = allMetaTemplates.find(
      (t) => t.name === templateName && t.language === languageCode,
    );
    if (metaTpl) {
      const buttonComp = (metaTpl.components as Array<{ type: string; buttons?: Array<{ type: string; url?: string; text?: string }> }>).find(
        (c) => c.type?.toUpperCase() === "BUTTONS",
      );
      console.log(`[sendConversationTemplate] botões do template (Meta):`, JSON.stringify(buttonComp ?? null, null, 2));
    }

    const result = await sendTemplateMessage(
      conv.phone,
      templateName,
      languageCode,
      components,
      cloudOverride,
    );
    const waMessageId =
      (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;

    console.log(`[sendConversationTemplate] Meta OK → waMessageId="${waMessageId}" savedMessage.id="${savedMessage?.id}"`);

    const updateResult = await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId })
      .where(eq(whatsappMessages.id, savedMessage.id))
      .returning({ id: whatsappMessages.id, status: whatsappMessages.status });

    console.log(`[sendConversationTemplate] DB update result:`, JSON.stringify(updateResult));

    if (conv.id) {
      publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return { waMessageId };
  } catch (err) {
    console.error(`[sendConversationTemplate] ERRO após Meta:`, err);
    throw err;
  }
}

const ALLOWED_MEDIA_TYPES: Record<string, "image" | "video" | "audio" | "document" | "sticker"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "sticker",
  "video/mp4": "video",
  "video/3gpp": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/opus": "audio",
  "audio/aac": "audio",
  "audio/mp4": "audio",
  "audio/webm": "audio", // remuxed to audio/ogg before upload — see sendConversationMedia
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "text/plain": "document",
};

export async function sendConversationMedia(
  conversationId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  userId: string,
  userRole: string,
  channelId?: number,
  caption?: string,
  replyToMessageId?: string,
) {
  console.log(`[sendConversationMedia] mimetype=${file.mimetype} size=${file.size} name=${file.originalname}`);

  // Chrome records audio/webm;codecs=opus which WhatsApp rejects.
  // Remux to OGG (same Opus bitstream, different container) transparently.
  let effectiveBuffer = file.buffer;
  let effectiveMime = file.mimetype;
  let effectiveName = file.originalname;
  if (file.mimetype === "audio/webm" || file.mimetype.startsWith("audio/webm;")) {
    console.log(`[sendConversationMedia] remuxing audio/webm → audio/ogg`);
    effectiveBuffer = remuxWebmOpusToOgg(file.buffer);
    effectiveMime = "audio/ogg";
    effectiveName = file.originalname.replace(/\.webm$/, ".ogg");
    console.log(`[sendConversationMedia] remux OK: ${effectiveBuffer.length} bytes`);
  }

  const mediaType = ALLOWED_MEDIA_TYPES[effectiveMime];
  if (!mediaType) throw new Error(`Tipo de arquivo não suportado: ${effectiveMime}`);

  console.log(`[sendConversationMedia] mediaType resolvido: ${mediaType}`);

  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({ id: whatsappConversations.id, phone: whatsappConversations.phone, clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) {
    console.warn(`[sendConversationMedia] conversa não encontrada: ${conversationId}`);
    return null;
  }

  console.log(`[sendConversationMedia] conversa: id=${conv.id} phone=${conv.phone}`);

  let replyToWaMessageId: string | null = null;
  if (replyToMessageId) {
    const [ref] = await db
      .select({ waMessageId: whatsappMessages.waMessageId })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.id, replyToMessageId))
      .limit(1);
    replyToWaMessageId = ref?.waMessageId ?? null;
  }

  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId);

  console.log(`[sendConversationMedia] provider=${resolvedChannel?.provider ?? "null"}`);

  let waMessageId: string | null = null;
  let waMediaId: string | null = null;

  if (resolvedChannel?.provider === "evolution") {
    const evoMediaType = mediaType === "sticker" ? "image" : mediaType;
    const base64 = effectiveBuffer.toString("base64");
    console.log(`[sendConversationMedia] Evolution sendMedia type=${evoMediaType}`);
    try {
      const evoResult = await evoSendMedia(
        resolvedChannel.evolutionInstanceName,
        conv.phone,
        evoMediaType,
        { base64: `data:${effectiveMime};base64,${base64}`, caption, filename: effectiveName, mimetype: effectiveMime },
      );
      waMessageId = evoResult?.key?.id ?? null;
    } catch (err) {
      console.error(`[sendConversationMedia] Evolution sendMedia falhou:`, err);
      throw err;
    }
  } else {
    const cloudOverride = resolvedChannel?.provider === "cloud_api"
      ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
      : null;

    console.log(`[sendConversationMedia] uploadMedia → mimetype=${effectiveMime} filename=${effectiveName}`);
    try {
      waMediaId = await uploadMedia(effectiveBuffer, effectiveName, effectiveMime, cloudOverride ?? undefined);
    } catch (err) {
      console.error(`[sendConversationMedia] uploadMedia falhou:`, err);
      throw err;
    }
    console.log(`[sendConversationMedia] waMediaId=${waMediaId} → sendMediaMessage type=${mediaType}`);
    try {
      const result = await sendMediaMessage(conv.phone, waMediaId, mediaType, caption ?? undefined, undefined, cloudOverride ?? undefined);
      waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
    } catch (err) {
      console.error(`[sendConversationMedia] sendMediaMessage falhou:`, err);
      throw err;
    }
  }

  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      channelId: resolvedChannel?.id ?? null,
      direction: "outbound",
      type: mediaType,
      content: null,
      caption: caption ?? null,
      status: "sent",
      waMessageId,
      sentByUserId: userId,
      sentAt: new Date(),
      replyToMessageId: replyToMessageId ?? null,
    })
    .returning({ id: whatsappMessages.id });

  await db
    .insert(whatsappMedia)
    .values({
      messageId: savedMessage.id,
      whatsappMediaId: waMediaId,
      mimeType: file.mimetype,
      filename: file.originalname,
      size: file.size,
    });

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  if (conv.id) {
    publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
  }

  return { id: savedMessage.id, status: "sent" };
}

export async function retryFailedMessage(
  messageId: string,
  clientIdOrConvId: string,
  userId: string,
  userRole: string,
) {
  const conversationId = await resolveConversationId(clientIdOrConvId);
  if (!conversationId) return null;

  const [msg] = await db
    .select({
      id: whatsappMessages.id,
      content: whatsappMessages.content,
      type: whatsappMessages.type,
      caption: whatsappMessages.caption,
      rawPayload: whatsappMessages.rawPayload,
      mediaId: whatsappMedia.id,
      waMediaId: whatsappMedia.whatsappMediaId,
      mimeType: whatsappMedia.mimeType,
      filename: whatsappMedia.filename,
    })
    .from(whatsappMessages)
    .leftJoin(whatsappMedia, eq(whatsappMedia.messageId, whatsappMessages.id))
    .where(
      and(
        eq(whatsappMessages.id, messageId),
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.status, "failed"),
      ),
    )
    .limit(1);

  if (!msg) {
    console.warn(`[retryFailedMessage] mensagem ${messageId} não encontrada ou não está com status=failed`);
    return null;
  }

  console.log(`[retryFailedMessage] msg: id=${msg.id} type=${msg.type} content=${msg.content} caption=${msg.caption} waMediaId=${msg.waMediaId} mimeType=${msg.mimeType} filename=${msg.filename}`);

  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({ id: whatsappConversations.id, phone: whatsappConversations.phone, clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) {
    console.warn(`[retryFailedMessage] conversa ${conversationId} não encontrada`);
    return null;
  }

  const channelOverride = await getChannelForConversation(conversationId).catch(() => null);
  console.log(`[retryFailedMessage] phone=${conv.phone} channelOverride=${channelOverride ? `phoneNumberId=${channelOverride.phoneNumberId}` : "null"}`);

  try {
    let result: unknown;

    // Mensagem de template do bot: re-envia o MESMO template (nome, idioma e
    // componentes interpolados gravados em rawPayload) em vez de mandar o texto
    // placeholder "Template: X" literalmente.
    const payload = msg.rawPayload as
      | { kind?: string; templateName?: string; language?: string; components?: object[] }
      | null;
    if (
      msg.type === "template" &&
      payload?.templateName &&
      (payload.kind === "bot_template" || payload.kind === "conversation_template")
    ) {
      console.log(`[retryFailedMessage] replay template="${payload.templateName}"`);
      const tplResult = await sendTemplateMessage(
        conv.phone,
        payload.templateName,
        payload.language ?? "pt_BR",
        payload.components ?? [],
        channelOverride ?? undefined,
      );
      const tplWaId = ((tplResult as { messages?: Array<{ id?: string }> })?.messages)?.[0]?.id ?? null;
      await db
        .update(whatsappMessages)
        .set({ status: "sent", waMessageId: tplWaId, sentAt: new Date() })
        .where(eq(whatsappMessages.id, messageId));
      if (conv.id) {
        publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
      }
      return "sent";
    }

    const isMedia = msg.type === "image" || msg.type === "document" || msg.type === "video" || msg.type === "audio";

    console.log(`[retryFailedMessage] isMedia=${isMedia} waMediaId=${msg.waMediaId}`);

    if (isMedia && msg.waMediaId) {
      const mediaTypeMap: Record<string, "image" | "document" | "video" | "audio"> = {
        image: "image", document: "document", video: "video", audio: "audio",
      };
      const mediaType = mediaTypeMap[msg.type!] ?? "document";
      console.log(`[retryFailedMessage] sendMediaMessage type=${mediaType} waMediaId=${msg.waMediaId}`);
      result = await sendMediaMessage(
        conv.phone,
        msg.waMediaId,
        mediaType,
        msg.caption ?? undefined,
        msg.filename ?? undefined,
        channelOverride ?? undefined,
      );
    } else if (isMedia && !msg.waMediaId) {
      console.error(`[retryFailedMessage] mensagem de mídia sem waMediaId — não é possível reenviar automaticamente`);
      throw new Error("Não foi possível reenviar: ID de mídia do WhatsApp ausente. Envie o arquivo novamente.");
    } else {
      if (!msg.content) throw new Error("Conteúdo da mensagem ausente para reenvio");
      console.log(`[retryFailedMessage] sendTextMessage content="${msg.content}"`);
      result = await sendTextMessage(conv.phone, msg.content, channelOverride ?? undefined);
    }

    console.log(`[retryFailedMessage] envio OK:`, JSON.stringify(result));
    const waMessageId = ((result as { messages?: Array<{ id?: string }> })?.messages)?.[0]?.id ?? null;

    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId, sentAt: new Date() })
      .where(eq(whatsappMessages.id, messageId));

    if (conv.id) {
      publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return "sent";
  } catch (err) {
    console.error(`[retryFailedMessage] FALHOU messageId=${messageId}:`, err);
    throw err;
  }
}

export async function saveInboundMessage(data: {
  phone: string;
  content: string | null;
  type: string;
  waMessageId: string;
  timestamp?: string;
  caption?: string;
  rawPayload?: unknown;
  channelId?: number | null;
  replyToWaMessageId?: string;
  /** Permite sobrescrever a direção da mensagem (padrão: "inbound"). Usado pelo Evolution para fromMe:true. */
  direction?: "inbound" | "outbound";
  /** @internal usado pelo Evolution webhook para indicar mensagem enviada pelo celular do vendedor */
  _fromMe?: boolean;
  mediaData?: {
    whatsappMediaId?: string;
    /** Chave R2 já uploadada (Baileys gateway — pula persistInboundMedia) */
    storageKey?: string;
    size?: number;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
}) {
  const [existing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waMessageId, data.waMessageId))
    .limit(1);

  if (existing) {
    console.log(`[WA Webhook] Mensagem duplicada ignorada: ${data.waMessageId}`);
    return;
  }

  const conv = await findOrCreateConversation(data.phone, data.channelId);

  const sentAt = data.timestamp
    ? new Date(Number(data.timestamp) * 1000)
    : undefined;

  // Resolve replyToMessageId (DB id) a partir do waMessageId da mensagem citada
  let replyToMessageId: string | null = null;
  if (data.replyToWaMessageId) {
    const [ref] = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.waMessageId, data.replyToWaMessageId))
      .limit(1);
    replyToMessageId = ref?.id ?? null;
  }

  const direction = data.direction ?? (data._fromMe ? "outbound" : "inbound");

  let savedMessage: { id: string };
  try {
    [savedMessage] = await db
      .insert(whatsappMessages)
      .values({
        conversationId: conv.id,
        channelId: data.channelId ?? null,
        direction,
        type: data.type,
        content: data.content,
        caption: data.caption ?? null,
        waMessageId: data.waMessageId,
        rawPayload: data.rawPayload ?? null,
        sentAt,
        replyToMessageId,
      })
      .returning({ id: whatsappMessages.id });
  } catch (err: unknown) {
    // Race condition: dois webhooks simultâneos com o mesmo waMessageId
    if ((err as { code?: string }).code === "23505") {
      console.log(`[WA Webhook] Mensagem duplicada ignorada (race): ${data.waMessageId}`);
      return;
    }
    throw err;
  }

  if (data.mediaData) {
    const [savedMedia] = await db
      .insert(whatsappMedia)
      .values({
        messageId: savedMessage.id,
        whatsappMediaId: data.mediaData.whatsappMediaId ?? null,
        storageKey: data.mediaData.storageKey ?? null,
        mimeType: data.mediaData.mimeType ?? null,
        filename: data.mediaData.filename ?? null,
        size: data.mediaData.size ?? null,
      })
      .returning({ id: whatsappMedia.id });

    // Se o storageKey já veio pré-uploadado (Baileys gateway), pula o download Meta
    if (!data.mediaData.storageKey && data.mediaData.whatsappMediaId) {
      await persistInboundMedia(
        savedMedia.id,
        data.mediaData.whatsappMediaId,
        data.mediaData.mimeType,
      );
    }
  }

  // Atualiza o "último canal usado" da conversa para refletir por onde o cliente
  // escreveu por último — usado como canal padrão de resposta.
  await db
    .update(whatsappConversations)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      ...(data.channelId != null ? { channelId: data.channelId } : {}),
    })
    .where(eq(whatsappConversations.id, conv.id));

  console.log(
    `[WA Webhook] Inbound de ${data.phone} → conversa: ${conv.id} (cliente: ${conv.clientId ?? "não encontrado"})`,
  );

  // Chaveado por clientId ?? id para casar com o conversationKey do frontend
  // (clientId ?? conversationId) — assim conversas sem cliente também recebem
  // atualização em tempo real no thread aberto.
  publishConversationEvent(conv.clientId ?? conv.id, "new_message", {
    clientId: conv.clientId ?? null,
  });

  publishSseEvent("new_whatsapp_inbound", { conversationId: conv.id, clientId: conv.clientId ?? null });
}

export async function getMediaById(id: string) {
  const [media] = await db
    .select()
    .from(whatsappMedia)
    .where(eq(whatsappMedia.id, id))
    .limit(1);
  return media ?? null;
}

export async function updateMediaStorageKey(id: string, storageKey: string, size: number) {
  await db
    .update(whatsappMedia)
    .set({ storageKey, size })
    .where(eq(whatsappMedia.id, id));
}

// Baixa a mídia da Meta e a persiste no R2, gravando o storageKey. Falhas apenas logam —
// não podem quebrar o salvamento da mensagem.
export async function persistInboundMedia(
  mediaRowId: string,
  whatsappMediaId: string,
  mimeType?: string,
) {
  try {
    const { buffer, contentType, size } = await downloadMediaToBuffer(whatsappMediaId);
    const storageKey = await uploadWhatsappMedia(buffer, mimeType ?? contentType);
    await updateMediaStorageKey(mediaRowId, storageKey, size);
    console.log(`[WA Media] Mídia ${whatsappMediaId} persistida no R2: ${storageKey}`);
  } catch (err) {
    console.error(`[WA Media] Falha ao persistir mídia ${whatsappMediaId}:`, err);
  }
}

export async function saveInboundReaction(data: {
  phone: string;
  waMessageId: string;
  emoji: string;
  channelId?: number | null;
}) {
  const [targetMsg] = await db
    .select({ id: whatsappMessages.id, conversationId: whatsappMessages.conversationId })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waMessageId, data.waMessageId))
    .limit(1);

  if (!targetMsg) {
    console.warn(`[WA Webhook] Reação para mensagem desconhecida: ${data.waMessageId}`);
    return;
  }

  if (!data.emoji) {
    await db
      .delete(whatsappReactions)
      .where(
        and(
          eq(whatsappReactions.messageId, targetMsg.id),
          eq(whatsappReactions.direction, "inbound"),
        ),
      );
  } else {
    await db
      .insert(whatsappReactions)
      .values({
        messageId: targetMsg.id,
        emoji: data.emoji,
        direction: "inbound",
        senderPhone: data.phone,
      })
      .onConflictDoUpdate({
        target: [whatsappReactions.messageId, whatsappReactions.direction],
        set: { emoji: data.emoji, senderPhone: data.phone },
      });
  }

  const [conv] = await db
    .select({ id: whatsappConversations.id, clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, targetMsg.conversationId))
    .limit(1);

  if (conv?.id) {
    publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
  }
}

export async function sendConversationReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
  userRole: string,
  channelId?: number,
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = or(
      eq(whatsappConversations.assignedAgentId, userId),
      and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
    );
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({ id: whatsappConversations.id, phone: whatsappConversations.phone, clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) return null;

  const [targetMsg] = await db
    .select({ waMessageId: whatsappMessages.waMessageId })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.id, messageId),
        eq(whatsappMessages.conversationId, conversationId),
      ),
    )
    .limit(1);

  if (!targetMsg?.waMessageId) return null;

  let channelOverride = null;
  if (userRole === "vendedor") {
    channelOverride = await getChannelByUserId(userId).catch(() => null)
      ?? await getChannelForConversation(conversationId).catch(() => null);
  } else if (channelId != null) {
    const ch = await getChannelById(channelId).catch(() => null);
    if (ch && ch.phoneNumberId && ch.accessToken) channelOverride = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
  } else {
    channelOverride = await getChannelForConversation(conversationId).catch(() => null);
  }

  await sendReaction(conv.phone, targetMsg.waMessageId, emoji, channelOverride ?? undefined);

  if (!emoji) {
    await db
      .delete(whatsappReactions)
      .where(
        and(
          eq(whatsappReactions.messageId, messageId),
          eq(whatsappReactions.direction, "outbound"),
        ),
      );
  } else {
    await db
      .insert(whatsappReactions)
      .values({ messageId, emoji, direction: "outbound" })
      .onConflictDoUpdate({
        target: [whatsappReactions.messageId, whatsappReactions.direction],
        set: { emoji },
      });
  }

  if (conv.id) {
    publishConversationEvent(conv.clientId ?? conv.id, "new_message", { clientId: conv.clientId ?? null });
  }

  return { ok: true };
}

export async function startConversationByClientId(
  clientId: string,
  userId: string,
  userRole: string,
) {
  const whereClause =
    userRole === "vendedor"
      ? and(eq(clients.id, clientId), eq(clients.responsavelId, userId))
      : eq(clients.id, clientId);

  const [client] = await db
    .select({ id: clients.id, phone: clients.phone, name: clients.name })
    .from(clients)
    .where(whereClause)
    .limit(1);

  if (!client?.phone) return null;

  const conv = await findOrCreateConversation(client.phone);

  if (!conv.clientId) {
    await db
      .update(whatsappConversations)
      .set({ clientId })
      .where(eq(whatsappConversations.id, conv.id));
  }

  return {
    conversationId: conv.id,
    clientId: client.id,
    clientName: client.name,
    phone: client.phone,
  };
}

export async function setContactWhatsappTags(clientId: string, whatsappTagIds: string[]): Promise<void> {
  await db
    .delete(contactTags)
    .where(and(eq(contactTags.clientId, clientId), isNotNull(contactTags.whatsappTagId)));
  if (whatsappTagIds.length > 0) {
    await db
      .insert(contactTags)
      .values(whatsappTagIds.map((whatsappTagId) => ({ clientId, whatsappTagId })));
  }
}

export async function markConversationRead(userId: string, conversationId: string) {
  await db
    .insert(whatsappConversationReads)
    .values({ userId, conversationId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [
        whatsappConversationReads.userId,
        whatsappConversationReads.conversationId,
      ],
      set: { lastReadAt: new Date() },
    });
}
