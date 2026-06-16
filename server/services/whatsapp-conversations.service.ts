import { db } from "../db";
import {
  clients,
  whatsappConversations,
  whatsappMessages,
  whatsappMedia,
  whatsappConversationReads,
} from "../../shared/schema";
import { eq, and, ilike, or, desc, sql, asc } from "drizzle-orm";
import { sendTextMessage, downloadMediaToBuffer } from "../integrations/whatsapp";
import { uploadWhatsappMedia } from "../lib/r2";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { getChannelForConversation } from "./whatsapp-channels.service";

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
    .limit(1);
  return conv?.id ?? null;
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
        lastContent: whatsappMessages.content,
        lastDirection: whatsappMessages.direction,
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
      unreadCount: sql<number>`coalesce(${unreadSub.unreadCount}, 0)`,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
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

  const messages = await db
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
    .where(eq(whatsappMessages.conversationId, conversationId))
    .orderBy(
      asc(sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`),
    )
    .limit(50);

  return { conversation: conv, messages };
}

export async function sendConversationMessage(
  conversationId: string,
  message: string,
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
    })
    .returning({ id: whatsappMessages.id });

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  const channelOverride = await getChannelForConversation(conversationId).catch(() => null);

  try {
    const result = await sendTextMessage(conv.phone, message, channelOverride ?? undefined);
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

export async function retryFailedMessage(
  messageId: string,
  clientId: string,
  userId: string,
  userRole: string,
) {
  const conversationId = await resolveConversationIdByClientId(clientId);
  if (!conversationId) return null;

  const [msg] = await db
    .select({ id: whatsappMessages.id, content: whatsappMessages.content })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.id, messageId),
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.status, "failed"),
      ),
    )
    .limit(1);

  if (!msg) return null;

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

  const channelOverride = await getChannelForConversation(conversationId).catch(() => null);

  try {
    const result = await sendTextMessage(conv.phone, msg.content!, channelOverride ?? undefined);
    const waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;

    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId, sentAt: new Date() })
      .where(eq(whatsappMessages.id, messageId));

    if (conv.clientId) {
      publishConversationEvent(conv.clientId, "new_message", { clientId: conv.clientId });
    }

    return "sent";
  } catch (err) {
    console.error(`[WA Conversations Service] Erro ao reenviar mensagem ${messageId}:`, err);
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
