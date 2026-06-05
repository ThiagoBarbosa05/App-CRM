import { db } from "../db";
import { clients, whatsappMessages, whatsappConversationReads } from "../../shared/schema";
import { eq, and, ilike, isNotNull, or, desc, sql, asc } from "drizzle-orm";
import { sendTextMessage } from "../integrations/whatsapp";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";

export async function listClientsForChat(
  userId: string,
  userRole: string,
  search?: string,
) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (userRole === "vendedor" && userId) {
    conditions.push(eq(clients.responsavelId, userId));
  }

  conditions.push(isNotNull(clients.phone));

  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.phone, `%${search}%`),
      ) as ReturnType<typeof eq>,
    );
  }

  const effectiveAt = sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`.as("last_at");

  const readsSub = db.$with("reads").as(
    db
      .select({
        clientId: whatsappConversationReads.clientId,
        lastReadAt: whatsappConversationReads.lastReadAt,
      })
      .from(whatsappConversationReads)
      .where(eq(whatsappConversationReads.userId, userId)),
  );

  const unreadSub = db.$with("unread").as(
    db
      .select({
        clientId: whatsappMessages.clientId,
        unreadCount: sql<number>`cast(count(*) as int)`.as("unread_count"),
      })
      .from(whatsappMessages)
      .leftJoin(readsSub, eq(whatsappMessages.clientId, readsSub.clientId))
      .where(
        and(
          isNotNull(whatsappMessages.clientId),
          eq(whatsappMessages.direction, "inbound"),
          sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt}) > COALESCE(${readsSub.lastReadAt}, '1970-01-01'::timestamp)`,
        ),
      )
      .groupBy(whatsappMessages.clientId),
  );

  const lastMsgSub = db.$with("last_msg").as(
    db
      .selectDistinctOn([whatsappMessages.clientId], {
        clientId: whatsappMessages.clientId,
        lastAt: effectiveAt,
        lastContent: whatsappMessages.content,
        lastDirection: whatsappMessages.direction,
      })
      .from(whatsappMessages)
      .where(isNotNull(whatsappMessages.clientId))
      .orderBy(whatsappMessages.clientId, desc(effectiveAt)),
  );

  return db
    .with(readsSub, unreadSub, lastMsgSub)
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      lastMessageAt: lastMsgSub.lastAt,
      lastMessageContent: lastMsgSub.lastContent,
      lastMessageDirection: lastMsgSub.lastDirection,
      unreadCount: sql<number>`coalesce(${unreadSub.unreadCount}, 0)`,
    })
    .from(clients)
    .leftJoin(lastMsgSub, eq(clients.id, lastMsgSub.clientId))
    .leftJoin(unreadSub, eq(clients.id, unreadSub.clientId))
    .where(and(...conditions))
    .orderBy(sql`${lastMsgSub.lastAt} DESC NULLS LAST`, asc(clients.name))
    .limit(100);
}

async function fetchClientWithOwnership(
  clientId: string,
  userId: string,
  userRole: string,
) {
  const conditions: ReturnType<typeof eq>[] = [eq(clients.id, clientId)];

  if (userRole === "vendedor") {
    conditions.push(eq(clients.responsavelId, userId));
  }

  const [client] = await db
    .select({ id: clients.id, phone: clients.phone })
    .from(clients)
    .where(and(...conditions))
    .limit(1);

  return client ?? null;
}

export async function getConversation(
  clientId: string,
  userId: string,
  userRole: string,
) {
  const client = await fetchClientWithOwnership(clientId, userId, userRole);
  if (!client) return null;

  // Normaliza o telefone do cliente para comparar com o campo phone das mensagens
  // Mensagens inbound chegam com DDI (ex: 5522988523633), outbound com formato do CRM
  const clientDigits = (client.phone ?? "").replace(/\D/g, "");
  const clientWithCountry =
    clientDigits.length <= 11 ? `55${clientDigits}` : clientDigits;

  const messages = await db
    .select()
    .from(whatsappMessages)
    .where(
      or(
        eq(whatsappMessages.clientId, clientId),
        sql`regexp_replace(${whatsappMessages.phone}, '\\D', '', 'g') = ${clientDigits}`,
        sql`regexp_replace(${whatsappMessages.phone}, '\\D', '', 'g') = ${clientWithCountry}`,
      ),
    )
    .orderBy(asc(sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`))
    .limit(50);

  return messages;
}

export async function sendConversationMessage(
  clientId: string,
  message: string,
  userId: string,
  userRole: string,
) {
  const client = await fetchClientWithOwnership(clientId, userId, userRole);
  if (!client) {
    console.warn(`[WA Conversations Service] Cliente ${clientId} não encontrado ou sem permissão para usuário ${userId} (${userRole})`);
    return null;
  }
  if (!client.phone) {
    console.warn(`[WA Conversations Service] Cliente ${clientId} não tem telefone`);
    return null;
  }

  console.log(`[WA Conversations Service] Enviando via WhatsApp Cloud API para ${client.phone}`);

  let result: any;
  try {
    result = await sendTextMessage(client.phone, message);
    console.log(`[WA Conversations Service] Resposta da Cloud API:`, JSON.stringify(result));
  } catch (err) {
    console.error(`[WA Conversations Service] Erro na Cloud API:`, err);
    throw err;
  }

  try {
    await db.insert(whatsappMessages).values({
      clientId,
      phone: client.phone,
      direction: "outbound",
      type: "text",
      content: message,
      waMessageId: result?.messages?.[0]?.id ?? null,
      status: "sent",
      sentByUserId: userId,
    });
  } catch (err) {
    console.error(`[WA Conversations Service] Erro ao salvar mensagem no banco:`, err);
    throw err;
  }

  return result;
}

export async function saveInboundMessage(data: {
  phone: string;
  content: string | null;
  type: string;
  waMessageId: string;
  timestamp?: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  mediaFilename?: string;
}) {
  // Deduplication: skip if this waMessageId was already saved (retry from WhatsApp API)
  const [existing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waMessageId, data.waMessageId))
    .limit(1);

  if (existing) {
    console.log(`[WA Webhook] Mensagem duplicada ignorada: ${data.waMessageId}`);
    return;
  }

  const digits = data.phone.replace(/\D/g, "");
  // Se vier com DDI 55 (13 dígitos), também tenta sem o DDI
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;

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

  console.log(
    `[WA Webhook] Inbound de ${data.phone} (digits: ${digits}) → cliente: ${matchedClient?.id ?? "não encontrado"}`,
  );

  const sentAt = data.timestamp ? new Date(Number(data.timestamp) * 1000) : undefined;

  await db.insert(whatsappMessages).values({
    clientId: matchedClient?.id ?? null,
    phone: data.phone,
    direction: "inbound",
    type: data.type,
    content: data.content,
    mediaId: data.mediaId ?? null,
    mimeType: data.mimeType ?? null,
    caption: data.caption ?? null,
    mediaFilename: data.mediaFilename ?? null,
    waMessageId: data.waMessageId,
    status: null,
    sentAt,
  });

  if (matchedClient?.id) {
    publishConversationEvent(matchedClient.id, "new_message", { clientId: matchedClient.id });
  }

  // Broadcast global para atualizar badges em tempo real para todos os usuários conectados
  publishSseEvent("new_whatsapp_inbound", { clientId: matchedClient?.id ?? null });
}

export async function markConversationRead(userId: string, clientId: string) {
  await db
    .insert(whatsappConversationReads)
    .values({ userId, clientId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [whatsappConversationReads.userId, whatsappConversationReads.clientId],
      set: { lastReadAt: new Date() },
    });
}
