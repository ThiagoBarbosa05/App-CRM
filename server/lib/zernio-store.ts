// Persistência do Inbox Unificado do Zernio (substituiu o armazenamento em
// memória usado durante os testes iniciais). Os ids das linhas são os mesmos
// ids que o Zernio usa (conversationId / message.id vindos do webhook).
//
// Requer as tabelas criadas por scripts/create-zernio-tables.mjs.
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { zernioConversations, zernioMessages } from "@shared/schema";

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

export async function listConversations(platform?: string): Promise<ZernioStoredConversation[]> {
  const rows = await db
    .select()
    .from(zernioConversations)
    .where(platform && platform !== "all" ? eq(zernioConversations.platform, platform) : undefined)
    .orderBy(desc(zernioConversations.lastMessageAt));
  return rows.map(toConversationDTO);
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
