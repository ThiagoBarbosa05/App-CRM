import { db } from "../db";
import {
  internalConversations,
  internalConversationMembers,
  internalMessages,
  internalMessageMedia,
  internalMessageReads,
  users,
  type InternalConversation,
  type InternalMessage,
} from "../../shared/schema";
import { eq, and, or, desc, asc, sql, inArray, ne, isNull, lt, ilike } from "drizzle-orm";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { clampLimit } from "../lib/cursor-pagination";

/** Chave normalizada e ordem-independente para o par de usuários de uma DM. */
function buildDmKey(userAId: string, userBId: string): string {
  return [userAId, userBId].sort().join(":");
}

export type ChatTab = "all" | "attendants" | "groups";

export type ConversationSummary = {
  id: string;
  type: "dm" | "group";
  name: string | null;
  avatarUrl: string | null;
  otherUser: { id: string; name: string; email: string } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  myRole: "owner" | "admin" | "member";
};

/** Verifica se o usuário é membro ativo (não saiu) da conversa. */
export async function isInternalConversationAccessibleToUser(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const [member] = await db
    .select({ id: internalConversationMembers.id })
    .from(internalConversationMembers)
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        eq(internalConversationMembers.userId, userId),
        isNull(internalConversationMembers.leftAt),
      ),
    )
    .limit(1);
  return !!member;
}

async function getActiveRole(
  conversationId: string,
  userId: string,
): Promise<"owner" | "admin" | "member" | null> {
  const [member] = await db
    .select({ role: internalConversationMembers.role })
    .from(internalConversationMembers)
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        eq(internalConversationMembers.userId, userId),
        isNull(internalConversationMembers.leftAt),
      ),
    )
    .limit(1);
  return (member?.role as "owner" | "admin" | "member" | undefined) ?? null;
}

/** owner/admin podem gerenciar o grupo (renomear, adicionar/remover membros, promover). */
async function isGroupManager(conversationId: string, userId: string): Promise<boolean> {
  const role = await getActiveRole(conversationId, userId);
  return role === "owner" || role === "admin";
}

async function insertSystemMessage(conversationId: string, content: string): Promise<void> {
  const [message] = await db
    .insert(internalMessages)
    .values({ conversationId, senderId: null, content, type: "system" })
    .returning();
  publishConversationEvent(conversationId, "internal_new_message", message);
}

/**
 * Busca a DM existente entre os dois usuários ou cria uma nova — nunca duplica,
 * graças ao unique(dm_key) em internal_conversations.
 */
export async function findOrCreateDmConversation(
  userAId: string,
  userBId: string,
): Promise<InternalConversation> {
  if (userAId === userBId) {
    throw new Error("Não é possível iniciar uma conversa consigo mesmo");
  }
  const dmKey = buildDmKey(userAId, userBId);

  const [existing] = await db
    .select()
    .from(internalConversations)
    .where(eq(internalConversations.dmKey, dmKey))
    .limit(1);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(internalConversations)
      .values({ type: "dm", dmKey, createdByUserId: userAId })
      .onConflictDoNothing({ target: internalConversations.dmKey })
      .returning();

    // Corrida: outra requisição criou a mesma DM entre a checagem e o insert.
    if (!conversation) {
      const [raceWinner] = await tx
        .select()
        .from(internalConversations)
        .where(eq(internalConversations.dmKey, dmKey))
        .limit(1);
      return raceWinner!;
    }

    await tx.insert(internalConversationMembers).values([
      { conversationId: conversation.id, userId: userAId, role: "member" },
      { conversationId: conversation.id, userId: userBId, role: "member" },
    ]);
    return conversation;
  });
}

export async function createGroup(params: {
  name: string;
  createdByUserId: string;
  memberUserIds: string[];
}): Promise<InternalConversation> {
  const { name, createdByUserId, memberUserIds } = params;
  if (!name.trim()) throw new Error("Nome do grupo é obrigatório");

  const otherMemberIds = Array.from(new Set(memberUserIds.filter((id) => id !== createdByUserId)));

  return db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(internalConversations)
      .values({ type: "group", name: name.trim(), createdByUserId })
      .returning();

    await tx.insert(internalConversationMembers).values([
      { conversationId: conversation.id, userId: createdByUserId, role: "owner" },
      ...otherMemberIds.map((userId) => ({
        conversationId: conversation.id,
        userId,
        role: "member" as const,
      })),
    ]);
    return conversation;
  });
}

export async function renameGroup(
  conversationId: string,
  name: string,
  actingUserId: string,
): Promise<InternalConversation> {
  if (!(await isGroupManager(conversationId, actingUserId))) {
    throw new Error("Apenas o dono ou administradores do grupo podem renomeá-lo");
  }
  const [updated] = await db
    .update(internalConversations)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(internalConversations.id, conversationId))
    .returning();
  await insertSystemMessage(conversationId, `O grupo foi renomeado para "${name.trim()}"`);
  return updated;
}

export async function addGroupMembers(
  conversationId: string,
  userIds: string[],
  actingUserId: string,
): Promise<void> {
  if (!(await isGroupManager(conversationId, actingUserId))) {
    throw new Error("Apenas o dono ou administradores do grupo podem adicionar membros");
  }

  const existing = await db
    .select({ userId: internalConversationMembers.userId, leftAt: internalConversationMembers.leftAt })
    .from(internalConversationMembers)
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        inArray(internalConversationMembers.userId, userIds),
      ),
    );
  const existingByUser = new Map(existing.map((row) => [row.userId, row]));

  const toReactivate = existing.filter((row) => row.leftAt !== null).map((row) => row.userId);
  const toInsert = userIds.filter((id) => !existingByUser.has(id));

  await db.transaction(async (tx) => {
    if (toReactivate.length > 0) {
      await tx
        .update(internalConversationMembers)
        .set({ leftAt: null, joinedAt: new Date(), role: "member" })
        .where(
          and(
            eq(internalConversationMembers.conversationId, conversationId),
            inArray(internalConversationMembers.userId, toReactivate),
          ),
        );
    }
    if (toInsert.length > 0) {
      await tx.insert(internalConversationMembers).values(
        toInsert.map((userId) => ({ conversationId, userId, role: "member" as const })),
      );
    }
  });

  const addedUsers = await db
    .select({ name: users.name })
    .from(users)
    .where(inArray(users.id, [...toReactivate, ...toInsert]));
  if (addedUsers.length > 0) {
    const names = addedUsers.map((u) => u.name).join(", ");
    await insertSystemMessage(conversationId, `${names} foi adicionado(a) ao grupo`);
  }
  publishConversationEvent(conversationId, "internal_member_added", { userIds });
}

export async function removeGroupMember(
  conversationId: string,
  userId: string,
  actingUserId: string,
): Promise<void> {
  const isSelfLeaving = userId === actingUserId;
  if (!isSelfLeaving && !(await isGroupManager(conversationId, actingUserId))) {
    throw new Error("Apenas o dono ou administradores do grupo podem remover membros");
  }

  await db
    .update(internalConversationMembers)
    .set({ leftAt: new Date() })
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        eq(internalConversationMembers.userId, userId),
      ),
    );

  const [target] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (target) {
    await insertSystemMessage(
      conversationId,
      isSelfLeaving ? `${target.name} saiu do grupo` : `${target.name} foi removido(a) do grupo`,
    );
  }
  publishConversationEvent(conversationId, "internal_member_removed", { userId });
}

export async function promoteToAdmin(
  conversationId: string,
  userId: string,
  actingUserId: string,
): Promise<void> {
  if (!(await isGroupManager(conversationId, actingUserId))) {
    throw new Error("Apenas o dono ou administradores do grupo podem promover membros");
  }
  await db
    .update(internalConversationMembers)
    .set({ role: "admin" })
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        eq(internalConversationMembers.userId, userId),
        isNull(internalConversationMembers.leftAt),
      ),
    );
  const [target] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (target) {
    await insertSystemMessage(conversationId, `${target.name} agora é administrador(a) do grupo`);
  }
}

export async function listGroupMembers(conversationId: string) {
  return db
    .select({
      userId: internalConversationMembers.userId,
      role: internalConversationMembers.role,
      joinedAt: internalConversationMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(internalConversationMembers)
    .innerJoin(users, eq(users.id, internalConversationMembers.userId))
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        isNull(internalConversationMembers.leftAt),
      ),
    );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  params: {
    content?: string;
    replyToMessageId?: string;
    media?: { url: string; mimeType: string; fileName?: string; sizeBytes?: number };
  },
): Promise<InternalMessage> {
  if (!(await isInternalConversationAccessibleToUser(conversationId, senderId))) {
    throw new Error("Você não é mais membro desta conversa");
  }
  if (!params.content?.trim() && !params.media) {
    throw new Error("Mensagem vazia");
  }

  const messageType = params.media ? (params.media.mimeType.startsWith("image/") ? "image" : "file") : "text";

  const message = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(internalMessages)
      .values({
        conversationId,
        senderId,
        content: params.content?.trim() || null,
        type: messageType,
        replyToMessageId: params.replyToMessageId ?? null,
      })
      .returning();

    if (params.media) {
      await tx.insert(internalMessageMedia).values({
        messageId: inserted.id,
        url: params.media.url,
        mimeType: params.media.mimeType,
        fileName: params.media.fileName,
        sizeBytes: params.media.sizeBytes,
      });
    }

    await tx
      .update(internalConversations)
      .set({ lastMessageAt: inserted.createdAt, updatedAt: new Date() })
      .where(eq(internalConversations.id, conversationId));

    return inserted;
  });

  const media = params.media
    ? await db
        .select()
        .from(internalMessageMedia)
        .where(eq(internalMessageMedia.messageId, message.id))
    : [];
  const fullMessage = { ...message, media };

  publishConversationEvent(conversationId, "internal_new_message", fullMessage);

  const members = await db
    .select({ userId: internalConversationMembers.userId })
    .from(internalConversationMembers)
    .where(
      and(
        eq(internalConversationMembers.conversationId, conversationId),
        isNull(internalConversationMembers.leftAt),
        ne(internalConversationMembers.userId, senderId),
      ),
    );
  for (const member of members) {
    publishSseEvent(
      "internal_conversation_updated",
      { conversationId, preview: params.content ?? "📎 Anexo" },
      member.userId,
    );
  }

  return fullMessage as InternalMessage;
}

export async function listMessages(
  conversationId: string,
  userId: string,
  options: { before?: string; limit?: unknown },
) {
  if (!(await isInternalConversationAccessibleToUser(conversationId, userId))) {
    throw new Error("Você não tem acesso a esta conversa");
  }
  const limit = clampLimit(options.limit, { fallback: 40, max: 100 });

  const conditions = [eq(internalMessages.conversationId, conversationId)];
  if (options.before) {
    conditions.push(lt(internalMessages.createdAt, new Date(options.before)));
  }

  const rows = await db
    .select()
    .from(internalMessages)
    .where(and(...conditions))
    .orderBy(desc(internalMessages.createdAt))
    .limit(limit);

  const messageIds = rows.map((r) => r.id);
  const media =
    messageIds.length > 0
      ? await db.select().from(internalMessageMedia).where(inArray(internalMessageMedia.messageId, messageIds))
      : [];
  const mediaByMessage = new Map<string, typeof media>();
  for (const m of media) {
    const list = mediaByMessage.get(m.messageId) ?? [];
    list.push(m);
    mediaByMessage.set(m.messageId, list);
  }

  return rows.reverse().map((row) => ({ ...row, media: mediaByMessage.get(row.id) ?? [] }));
}

export async function markAsRead(conversationId: string, userId: string): Promise<void> {
  await db
    .insert(internalMessageReads)
    .values({ userId, conversationId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [internalMessageReads.userId, internalMessageReads.conversationId],
      set: { lastReadAt: new Date() },
    });
}

/** Implementa as 3 abas do print: Todos (dm+grupo), Atendentes (diretório) e Grupos. */
export async function listConversationsForUser(
  userId: string,
  tab: ChatTab,
  search?: string,
): Promise<ConversationSummary[]> {
  if (tab === "attendants") {
    const conditions = [eq(users.isActive, "true"), ne(users.id, userId)];
    if (search?.trim()) conditions.push(ilike(users.name, `%${search.trim()}%`));

    const attendants = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.name));

    const dmKeys = attendants.map((a) => buildDmKey(userId, a.id));
    const existingDms =
      dmKeys.length > 0
        ? await db
            .select({
              id: internalConversations.id,
              dmKey: internalConversations.dmKey,
              lastMessageAt: internalConversations.lastMessageAt,
            })
            .from(internalConversations)
            .where(inArray(internalConversations.dmKey, dmKeys))
        : [];
    const dmByKey = new Map(existingDms.map((c) => [c.dmKey, c]));

    return attendants.map((attendant) => {
      const dm = dmByKey.get(buildDmKey(userId, attendant.id));
      return {
        id: dm?.id ?? `pending:${attendant.id}`,
        type: "dm" as const,
        name: attendant.name,
        avatarUrl: null,
        otherUser: attendant,
        lastMessageAt: dm?.lastMessageAt ? dm.lastMessageAt.toISOString() : null,
        lastMessagePreview: null,
        unreadCount: 0,
        myRole: "member" as const,
      };
    });
  }

  const typeCondition = tab === "groups" ? eq(internalConversations.type, "group") : undefined;
  const otherUserAlias = { id: users.id, name: users.name, email: users.email };

  const rows = await db
    .select({
      conversation: internalConversations,
      myRole: internalConversationMembers.role,
      lastReadAt: internalMessageReads.lastReadAt,
    })
    .from(internalConversationMembers)
    .innerJoin(internalConversations, eq(internalConversations.id, internalConversationMembers.conversationId))
    .leftJoin(
      internalMessageReads,
      and(
        eq(internalMessageReads.conversationId, internalConversations.id),
        eq(internalMessageReads.userId, userId),
      ),
    )
    .where(
      and(
        eq(internalConversationMembers.userId, userId),
        isNull(internalConversationMembers.leftAt),
        eq(internalConversations.isArchived, false),
        typeCondition,
      ),
    )
    .orderBy(desc(internalConversations.lastMessageAt));

  const result: ConversationSummary[] = [];
  for (const row of rows) {
    let otherUser: ConversationSummary["otherUser"] = null;
    if (row.conversation.type === "dm") {
      const [member] = await db
        .select(otherUserAlias)
        .from(internalConversationMembers)
        .innerJoin(users, eq(users.id, internalConversationMembers.userId))
        .where(
          and(
            eq(internalConversationMembers.conversationId, row.conversation.id),
            ne(internalConversationMembers.userId, userId),
          ),
        )
        .limit(1);
      otherUser = member ?? null;
    }

    const [lastMessage] = await db
      .select({ content: internalMessages.content, type: internalMessages.type })
      .from(internalMessages)
      .where(eq(internalMessages.conversationId, row.conversation.id))
      .orderBy(desc(internalMessages.createdAt))
      .limit(1);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(internalMessages)
      .where(
        and(
          eq(internalMessages.conversationId, row.conversation.id),
          row.lastReadAt ? sql`${internalMessages.createdAt} > ${row.lastReadAt}` : sql`true`,
          ne(sql`coalesce(${internalMessages.senderId}, '')`, userId),
        ),
      );

    if (search?.trim()) {
      const term = search.trim().toLowerCase();
      const label = (row.conversation.name ?? otherUser?.name ?? "").toLowerCase();
      if (!label.includes(term)) continue;
    }

    result.push({
      id: row.conversation.id,
      type: row.conversation.type as "dm" | "group",
      name: row.conversation.name,
      avatarUrl: row.conversation.avatarUrl,
      otherUser,
      lastMessageAt: row.conversation.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: lastMessage
        ? lastMessage.type === "text"
          ? lastMessage.content
          : lastMessage.type === "system"
            ? lastMessage.content
            : "📎 Anexo"
        : null,
      unreadCount: count,
      myRole: row.myRole as "owner" | "admin" | "member",
    });
  }

  return result;
}
