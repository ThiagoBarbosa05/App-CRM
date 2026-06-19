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
} from "../../shared/schema";
import { eq, and, ilike, or, desc, sql, asc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { sendTextMessage, uploadMedia, sendMediaMessage, sendReaction, downloadMediaToBuffer } from "../integrations/whatsapp";
import { uploadWhatsappMedia } from "../lib/r2";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { getChannelByUserId, getChannelById, getChannelForConversation } from "./whatsapp-channels.service";
import { remuxWebmOpusToOgg } from "../lib/webm-opus-to-ogg";

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

  // When a channelId is provided, scope the lookup to that specific channel so
  // the same client number can have separate conversations per vendor.
  const whereClause = channelId != null
    ? and(phoneCondition, eq(whatsappConversations.channelId, channelId))
    : phoneCondition;

  const [existing] = await db
    .select()
    .from(whatsappConversations)
    .where(whereClause)
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

export async function listClientsForChat(
  userId: string,
  userRole: string,
  search?: string,
) {
  const effectiveAt = sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`.as("last_at");

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

  if (userRole === "vendedor" && userId) {
    conditions.push(eq(clients.responsavelId, userId));
  }

  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(whatsappConversations.phone, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  return db
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
}

export async function getConversation(
  conversationId: string,
  userId: string,
  userRole: string,
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    whereConditions.push(eq(clients.responsavelId, userId));
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
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(
      desc(sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`),
    )
    .limit(100);

  rawMessages.reverse();

  const messageIds = rawMessages.map((m) => m.id);
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

  const messages = rawMessages.map((m) => ({
    ...m,
    reactions: reactionsByMessage.get(m.id) ?? [],
  }));

  return { conversation: conv, messages };
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
    whereConditions.push(eq(clients.responsavelId, userId));
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

  // Persiste a mensagem imediatamente como "failed" — atualiza para "sent" se a API responder ok
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
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

  let channelOverride = null;
  if (userRole === "vendedor") {
    channelOverride = await getChannelByUserId(userId).catch(() => null)
      ?? await getChannelForConversation(conversationId).catch(() => null);
  } else if (channelId != null) {
    const ch = await getChannelById(channelId).catch(() => null);
    if (ch) {
      channelOverride = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
      await db
        .update(whatsappConversations)
        .set({ channelId })
        .where(eq(whatsappConversations.id, conversationId));
    }
  } else {
    channelOverride = await getChannelForConversation(conversationId).catch(() => null);
  }

  try {
    const result = await sendTextMessage(conv.phone, message, channelOverride ?? undefined, replyToWaMessageId ?? undefined);
    const waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;

    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId })
      .where(eq(whatsappMessages.id, savedMessage.id));

    // Publica o evento SSE somente após o status "sent" estar gravado no banco,
    // evitando que o frontend refaça a query e veja status "failed" prematuramente
    if (conv.clientId) {
      publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
    }

    return result;
  } catch (err) {
    console.error(`[WA Conversations Service] Erro na Cloud API:`, err);
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
    whereConditions.push(eq(clients.responsavelId, userId));
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

  let channelOverride = null;
  if (userRole === "vendedor") {
    channelOverride = await getChannelByUserId(userId).catch(() => null)
      ?? await getChannelForConversation(conversationId).catch(() => null);
  } else if (channelId != null) {
    const ch = await getChannelById(channelId).catch(() => null);
    if (ch) {
      channelOverride = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
      await db
        .update(whatsappConversations)
        .set({ channelId })
        .where(eq(whatsappConversations.id, conversationId));
    }
  } else {
    channelOverride = await getChannelForConversation(conversationId).catch(() => null);
  }

  console.log(`[sendConversationMedia] channelOverride=${channelOverride ? `phoneNumberId=${channelOverride.phoneNumberId}` : "null (default)"}`);
  console.log(`[sendConversationMedia] uploadMedia → mimetype=${effectiveMime} filename=${effectiveName}`);

  let waMediaId: string;
  try {
    waMediaId = await uploadMedia(
      effectiveBuffer,
      effectiveName,
      effectiveMime,
      channelOverride ?? undefined,
    );
  } catch (err) {
    console.error(`[sendConversationMedia] uploadMedia falhou:`, err);
    throw err;
  }

  console.log(`[sendConversationMedia] waMediaId=${waMediaId} → sendMediaMessage type=${mediaType}`);

  let result: Awaited<ReturnType<typeof sendMediaMessage>>;
  try {
    result = await sendMediaMessage(
      conv.phone,
      waMediaId,
      mediaType,
      caption ?? undefined,
      undefined,
      channelOverride ?? undefined,
    );
  } catch (err) {
    console.error(`[sendConversationMedia] sendMediaMessage falhou:`, err);
    throw err;
  }

  console.log(`[sendConversationMedia] sendMediaMessage OK:`, JSON.stringify(result));

  const waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;

  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
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

  if (conv.clientId) {
    publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
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
    whereConditions.push(eq(clients.responsavelId, userId));
  }

  const [conv] = await db
    .select({ phone: whatsappConversations.phone, clientId: whatsappConversations.clientId })
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

    if (conv.clientId) {
      publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
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
  mediaData?: {
    whatsappMediaId: string;
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

  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId: conv.id,
      direction: "inbound",
      type: data.type,
      content: data.content,
      caption: data.caption ?? null,
      waMessageId: data.waMessageId,
      rawPayload: data.rawPayload ?? null,
      sentAt,
      replyToMessageId,
    })
    .returning({ id: whatsappMessages.id });

  if (data.mediaData) {
    const [savedMedia] = await db
      .insert(whatsappMedia)
      .values({
        messageId: savedMessage.id,
        whatsappMediaId: data.mediaData.whatsappMediaId,
        mimeType: data.mediaData.mimeType ?? null,
        filename: data.mediaData.filename ?? null,
      })
      .returning({ id: whatsappMedia.id });

    // Persiste a mídia no R2 enquanto o ID da Meta ainda é válido (ela expira após uma janela curta).
    await persistInboundMedia(
      savedMedia.id,
      data.mediaData.whatsappMediaId,
      data.mediaData.mimeType,
    );
  }

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conv.id));

  console.log(
    `[WA Webhook] Inbound de ${data.phone} → conversa: ${conv.id} (cliente: ${conv.clientId ?? "não encontrado"})`,
  );

  if (conv.clientId) {
    publishConversationEvent(conv.clientId, "new_message", {
      clientId: conv.clientId,
    });
  }

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
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, targetMsg.conversationId))
    .limit(1);

  if (conv?.clientId) {
    publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
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
    whereConditions.push(eq(clients.responsavelId, userId));
  }

  const [conv] = await db
    .select({ phone: whatsappConversations.phone, clientId: whatsappConversations.clientId })
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
    if (ch) channelOverride = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
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

  if (conv.clientId) {
    publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
  }

  return { ok: true };
}

export async function startConversationByClientId(clientId: string) {
  const [client] = await db
    .select({ id: clients.id, phone: clients.phone, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
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
