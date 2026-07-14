// Persistência do Inbox Unificado do Zernio (substituiu o armazenamento em
// memória usado durante os testes iniciais). Os ids das linhas são os mesmos
// ids que o Zernio usa (conversationId / message.id vindos do webhook).
//
// Requer as tabelas criadas por scripts/create-zernio-tables.mjs.
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { clients, zernioConversations, zernioMessages } from "@shared/schema";

export interface ZernioStoredMessage {
  id: string;
  conversationId: string;
  direction: "incoming" | "outgoing";
  text?: string;
  timestamp: string;
  sender?: { id?: string; name?: string };
}

export interface ZernioStoredConversation {
  id: string;
  platform: string;
  accountId: string;
  participant?: { id: string; name?: string; username?: string };
  lastMessage?: { text: string; timestamp: string; direction: "incoming" | "outgoing" };
  unreadCount: number;
  clientId?: string | null;
  clientName?: string | null;
}

function toConversationDTO(row: typeof zernioConversations.$inferSelect): ZernioStoredConversation {
  const hasParticipant = !!(row.participantId || row.participantName || row.participantUsername);
  return {
    id: row.id,
    platform: row.platform,
    accountId: row.accountId,
    participant: hasParticipant
      ? {
          id: row.participantId ?? "",
          name: row.participantName ?? undefined,
          username: row.participantUsername ?? undefined,
        }
      : undefined,
    lastMessage:
      row.lastMessageAt && row.lastMessageDirection
        ? {
            text: row.lastMessageText ?? "",
            timestamp: row.lastMessageAt.toISOString(),
            direction: row.lastMessageDirection as "incoming" | "outgoing",
          }
        : undefined,
    unreadCount: row.unreadCount,
    clientId: row.clientId,
  };
}

function toMessageDTO(row: typeof zernioMessages.$inferSelect): ZernioStoredMessage {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction as "incoming" | "outgoing",
    text: row.text ?? undefined,
    timestamp: row.sentAt.toISOString(),
    sender: row.senderId || row.senderName ? { id: row.senderId ?? undefined, name: row.senderName ?? undefined } : undefined,
  };
}

export async function upsertConversation(
  partial: Partial<Omit<ZernioStoredConversation, "id">> & { id: string },
): Promise<ZernioStoredConversation> {
  const [existing] = await db.select().from(zernioConversations).where(eq(zernioConversations.id, partial.id));

  const values = {
    id: partial.id,
    platform: partial.platform ?? existing?.platform ?? "whatsapp",
    accountId: partial.accountId ?? existing?.accountId ?? "",
    participantId: partial.participant?.id ?? existing?.participantId ?? null,
    participantName: partial.participant?.name ?? existing?.participantName ?? null,
    participantUsername: partial.participant?.username ?? existing?.participantUsername ?? null,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(zernioConversations)
    .values(values)
    .onConflictDoUpdate({ target: zernioConversations.id, set: values })
    .returning();

  return toConversationDTO(row);
}

/** Retorna `true` se a mensagem era nova (ignora reentregas do webhook com o mesmo id). */
export async function addMessage(message: ZernioStoredMessage): Promise<boolean> {
  const inserted = await db
    .insert(zernioMessages)
    .values({
      id: message.id,
      conversationId: message.conversationId,
      direction: message.direction,
      text: message.text ?? null,
      senderId: message.sender?.id ?? null,
      senderName: message.sender?.name ?? null,
      sentAt: new Date(message.timestamp),
    })
    .onConflictDoNothing()
    .returning({ id: zernioMessages.id });

  if (inserted.length === 0) return false;

  await db
    .update(zernioConversations)
    .set({
      lastMessageText: message.text ?? "",
      lastMessageAt: new Date(message.timestamp),
      lastMessageDirection: message.direction,
      unreadCount:
        message.direction === "incoming"
          ? sql`${zernioConversations.unreadCount} + 1`
          : zernioConversations.unreadCount,
      updatedAt: new Date(),
    })
    .where(eq(zernioConversations.id, message.conversationId));

  return true;
}

/**
 * Detecta o eco de uma mensagem outgoing já registrada pela rota de envio síncrono
 * (POST /conversations/:id/messages), cujo webhook do Zernio pode reportar com um
 * `id` diferente do id retornado na resposta do envio. Usada para evitar inserir
 * uma segunda linha (e duplicar a mensagem na UI) quando os ids não batem.
 */
export async function hasRecentOutgoingMessage(
  conversationId: string,
  text: string | undefined,
  timestamp: string,
  windowSeconds = 15,
): Promise<boolean> {
  const center = new Date(timestamp);
  const from = new Date(center.getTime() - windowSeconds * 1000);
  const to = new Date(center.getTime() + windowSeconds * 1000);

  const rows = await db
    .select({ id: zernioMessages.id })
    .from(zernioMessages)
    .where(
      and(
        eq(zernioMessages.conversationId, conversationId),
        eq(zernioMessages.direction, "outgoing"),
        eq(zernioMessages.text, text ?? ""),
        gte(zernioMessages.sentAt, from),
        lte(zernioMessages.sentAt, to),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function listConversations(platform?: string): Promise<ZernioStoredConversation[]> {
  const rows = await db
    .select({ conversation: zernioConversations, clientName: clients.name })
    .from(zernioConversations)
    .leftJoin(clients, eq(zernioConversations.clientId, clients.id))
    .where(platform && platform !== "all" ? eq(zernioConversations.platform, platform) : undefined)
    .orderBy(desc(zernioConversations.lastMessageAt));
  return rows.map((row) => ({ ...toConversationDTO(row.conversation), clientName: row.clientName ?? null }));
}

export async function listMessages(conversationId: string): Promise<ZernioStoredMessage[]> {
  const rows = await db
    .select()
    .from(zernioMessages)
    .where(eq(zernioMessages.conversationId, conversationId))
    .orderBy(asc(zernioMessages.sentAt));
  return rows.map(toMessageDTO);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await db
    .update(zernioConversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(zernioConversations.id, conversationId));
}

/** Vincula (ou cria) a conversa a um cliente do CRM. */
export async function linkConversationToClient(params: {
  conversationId: string;
  platform: string;
  accountId: string;
  clientId: string;
  linkedByUserId?: string;
}): Promise<void> {
  const [existing] = await db
    .select()
    .from(zernioConversations)
    .where(eq(zernioConversations.id, params.conversationId));

  const values = {
    id: params.conversationId,
    platform: params.platform || existing?.platform || "whatsapp",
    accountId: params.accountId || existing?.accountId || "",
    clientId: params.clientId,
    linkedByUserId: params.linkedByUserId ?? null,
    linkedAt: new Date(),
    updatedAt: new Date(),
  };

  await db
    .insert(zernioConversations)
    .values(values)
    .onConflictDoUpdate({
      target: zernioConversations.id,
      set: {
        clientId: values.clientId,
        linkedByUserId: values.linkedByUserId,
        linkedAt: values.linkedAt,
        updatedAt: values.updatedAt,
      },
    });

  // Preenche automaticamente o campo Instagram do cliente com o usuário/participante
  // vinculado, caso o campo ainda esteja vazio.
  if (values.platform === "instagram") {
    const conv = existing ?? (await db.select().from(zernioConversations).where(eq(zernioConversations.id, params.conversationId)).then((r) => r[0]));
    const handle = conv?.participantUsername || conv?.participantName;
    if (handle) {
      const [clientRow] = await db.select({ instagram: clients.instagram }).from(clients).where(eq(clients.id, params.clientId));
      if (clientRow && !clientRow.instagram) {
        await db.update(clients).set({ instagram: handle }).where(eq(clients.id, params.clientId));
      }
    }
  }
}

export async function getConversationsByClient(clientId: string): Promise<ZernioStoredConversation[]> {
  const rows = await db
    .select({ conversation: zernioConversations, clientName: clients.name })
    .from(zernioConversations)
    .leftJoin(clients, eq(zernioConversations.clientId, clients.id))
    .where(eq(zernioConversations.clientId, clientId))
    .orderBy(desc(zernioConversations.lastMessageAt));
  return rows.map((row) => ({ ...toConversationDTO(row.conversation), clientName: row.clientName ?? null }));
}

export async function unlinkConversationFromClient(conversationId: string): Promise<void> {
  await db
    .update(zernioConversations)
    .set({ clientId: null, linkedByUserId: null, linkedAt: null, updatedAt: new Date() })
    .where(eq(zernioConversations.id, conversationId));
}
