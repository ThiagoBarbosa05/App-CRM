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
  whatsappSectors,
  users,
} from "../../shared/schema";
import { eq, and, ilike, or, desc, sql, asc, inArray, isNotNull, isNull, ne, gte, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { sendTextMessage, sendTemplateMessage, uploadMedia, sendMediaMessage, sendReaction, downloadMediaToBuffer } from "../integrations/whatsapp";
import { sendText as evoSendText, sendMedia as evoSendMedia, normalizeToJid, fetchProfilePictureUrl } from "../integrations/evolution";
import { uploadWhatsappMedia, getPublicR2Url } from "../lib/r2";
import { getTemplateMedia, fetchMetaTemplates } from "./whatsapp-templates.service";
import { publishConversationEvent, publishSseEvent, revokeStaleConversationAccess } from "../lib/sse-hub";
import { getChannelById, getChannelForConversation, resolveChannelById, resolveChannelForConversation, getActiveChannelIdByUserId, listChannelIdsForUser, getDefaultSectorIdForChannel } from "./whatsapp-channels.service";
import type { ResolvedChannel } from "./whatsapp-channels.service";
import { listSectorIdsForUser } from "./whatsapp-sectors.service";
import { remuxWebmOpusToOgg } from "../lib/webm-opus-to-ogg";
import { Cursor, clampLimit, encodeCursor } from "../lib/cursor-pagination";

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry =
    digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return { digits, withoutCountry };
}

// Escopo de visibilidade de um vendedor sobre conversas de WhatsApp: conversas
// atribuídas a ele, conversas sem atribuição de clientes onde ele é o
// responsável no CRM, e conversas da fila de setor (setor = fila; transferir
// para um setor sem escolher atendente deixa a conversa visível aos membros
// dele). A visibilidade pela fila exige setor E canal permitidos — um vendedor
// só vê a fila de um setor nos canais aos quais também tem acesso (ex: setor
// "Suporte" recebe em vários números, mas o atendente só vê o que chegou pelos
// números dele). Conversas já atribuídas diretamente continuam sempre visíveis,
// independente de canal — isso é posse, não fila.
async function vendorScopeCondition(userId: string) {
  const [sectorIds, channelIds] = await Promise.all([
    listSectorIdsForUser(userId),
    listChannelIdsForUser(userId),
  ]);
  const clauses = [
    eq(whatsappConversations.assignedAgentId, userId),
    and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, userId)),
  ];
  if (sectorIds.length > 0 && channelIds.length > 0) {
    clauses.push(
      and(
        inArray(whatsappConversations.sectorId, sectorIds),
        inArray(whatsappConversations.channelId, channelIds),
      ),
    );
  }
  return or(...clauses);
}

/**
 * Confere se um vendedor tem acesso (setor/canal vinculado, atribuição direta
 * ou responsabilidade do cliente) a uma conversa específica. Roles diferentes
 * de "vendedor" sempre têm acesso. Usar em toda ação que recebe um
 * conversationId vindo do usuário (fechar, reabrir, marcar como lida,
 * vincular cliente, disparar bot, servir mídia, etc.) para evitar IDOR.
 */
export async function isConversationAccessibleToUser(
  conversationId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole !== "vendedor") return true;

  const scope = await vendorScopeCondition(userId);
  const whereConditions: ReturnType<typeof eq>[] = [eq(whatsappConversations.id, conversationId)];
  if (scope) whereConditions.push(scope);

  const [conv] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  return !!conv;
}

/**
 * Confere se um vendedor tem qualquer relação com um cliente (é o
 * responsável no CRM) — usado como fallback de autorização em ações sobre um
 * clientId que ainda não tem conversa de WhatsApp (ex.: definir tags), caso
 * em que `isConversationAccessibleToUser` não tem o que checar.
 */
export async function isClientAccessibleToUser(
  clientId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole !== "vendedor") return true;

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.responsavelId, userId)))
    .limit(1);

  return !!client;
}

export async function findOrCreateConversation(phone: string, channelId?: number | null, contactName?: string) {
  const { digits, withoutCountry } = normalizePhone(phone);

  const phoneCondition = or(
    sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${digits}`,
    sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${withoutCountry}`,
  );

  // Conversa é UMA por telefone + canal — cada canal pertence a um atendente
  // (whatsapp_channels.user_id), então isso isola a conversa por atendente
  // individual (ex.: Umbler). channelId `null` explícito forma seu próprio
  // "balde" (ex.: disparo de campanha, que não tem canal/atendente dono).
  // channelId OMITIDO (undefined) preserva o comportamento antigo de casar
  // por telefone em QUALQUER canal — usado pelo motor de bot, que não tem
  // identidade de canal própria e depende de sempre achar a mesma conversa
  // ao longo de uma sessão, mesmo depois que ela ganha um canal (transferência
  // para atendente, resposta do contato via webhook etc.).
  const channelCondition =
    channelId === undefined
      ? undefined
      : channelId === null
        ? isNull(whatsappConversations.channelId)
        : eq(whatsappConversations.channelId, channelId);

  const [existing] = await db
    .select()
    .from(whatsappConversations)
    .where(channelCondition ? and(phoneCondition, channelCondition) : phoneCondition)
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

  // Herda o setor padrão do canal (se configurado) para que a conversa não
  // nasça sem setor e, por isso, fique invisível a todo vendedor sob a regra
  // de vendorScopeCondition (setor E canal).
  const defaultSectorId = channelId ? await getDefaultSectorIdForChannel(channelId) : null;

  const [created] = await db
    .insert(whatsappConversations)
    .values({
      phone,
      clientId: matchedClient?.id ?? null,
      channelId: channelId ?? null,
      sectorId: defaultSectorId,
      contactName: matchedClient ? null : (contactName ?? null),
    })
    .returning();

  // Flag efêmera (não é coluna do banco) usada por saveInboundMessage para
  // saber que este é o primeiro contato desse telefone, sem precisar de uma
  // segunda query.
  return { ...created, _wasCreated: true as const };
}

/**
 * Preenche o setor de uma conversa a partir do setor padrão do canal — só
 * quando ela ainda não tem setor nenhum (WHERE sectorId IS NULL protege contra
 * sobrescrever um setor já atribuído manualmente ou herdado de outro canal).
 * Chamada tanto no recebimento (saveInboundMessage) quanto no envio
 * (resolveOutboundChannel) para conversas que ficaram sem setor na criação —
 * ex.: iniciadas pelo atendente antes de haver canal escolhido, ou criadas por
 * bot/campanha sem channelId.
 */
async function backfillSectorFromChannel(conversationId: string, channelId: number) {
  const defaultSectorId = await getDefaultSectorIdForChannel(channelId);
  if (!defaultSectorId) return;
  await db
    .update(whatsappConversations)
    .set({ sectorId: defaultSectorId })
    .where(and(eq(whatsappConversations.id, conversationId), isNull(whatsappConversations.sectorId)));
}

// Vincula automaticamente conversas órfãs (client_id NULL) ao cliente cujo
// telefone bate. Chamada ao criar/editar um cliente, pois a conversa pode ter
// sido criada (por bot, campanha ou webhook) antes do cliente existir no CRM,
// ou com o telefone salvo num formato que o match em findOrCreateConversation
// não reconciliou na hora.
export async function autoLinkConversationsByPhone(phone: string, clientId: string) {
  const { digits, withoutCountry } = normalizePhone(phone);
  if (!digits) return;

  const linked = await db
    .update(whatsappConversations)
    .set({ clientId, updatedAt: new Date() })
    .where(
      and(
        isNull(whatsappConversations.clientId),
        or(
          sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${digits}`,
          sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${withoutCountry}`,
        ),
      ),
    )
    .returning({ id: whatsappConversations.id });

  for (const row of linked) {
    publishSseEvent("new_whatsapp_inbound", { conversationId: row.id, clientId });
  }

  return linked.length;
}

// Resolve o canal de envio de uma conversa. Se channelId for fornecido (override
// manual de admin), usa esse canal e o grava como último canal da conversa.
// Caso contrário, usa o último canal por onde o cliente escreveu (conversa).
// requestingUserId, quando informado e o usuário for "vendedor", valida que o
// channelId pedido está entre os canais dele (dono ou concessão explícita) —
// sem isso um vendedor poderia enviar mensagens usando as credenciais de um
// canal alheio e sobrescrever channelId da conversa, tirando-a da fila de
// outro setor/canal indevidamente.
export async function resolveOutboundChannel(
  conversationId: string,
  channelId?: number,
  requestingUserId?: string,
): Promise<ResolvedChannel | null> {
  if (channelId != null) {
    let allowed = true;
    if (requestingUserId) {
      const [requester] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, requestingUserId))
        .limit(1);
      if (requester?.role === "vendedor") {
        const allowedChannelIds = await listChannelIdsForUser(requestingUserId);
        allowed = allowedChannelIds.includes(channelId);
        if (!allowed) {
          console.warn(
            `[resolveOutboundChannel] usuário ${requestingUserId} tentou usar canal ${channelId} fora do seu escopo — ignorando override.`,
          );
        }
      }
    }

    if (allowed) {
      const ch = await resolveChannelById(channelId).catch(() => null);
      if (ch) {
        await db
          .update(whatsappConversations)
          .set({ channelId })
          .where(eq(whatsappConversations.id, conversationId));
        await backfillSectorFromChannel(conversationId, channelId);
        return ch;
      }
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

// Registra uma mensagem de sistema no histórico da conversa marcando a transferência,
// incluindo o motivo informado pelo atendente (se houver) — mesmo padrão usado por closeConversation.
async function logTransferMessage(conversationId: string, description: string, reason?: string) {
  await db.insert(whatsappMessages).values({
    conversationId,
    direction: "outbound",
    type: "system",
    content: reason ? `🔀 ${description}\nMotivo: ${reason}` : `🔀 ${description}`,
    status: "sent",
    sentAt: new Date(),
  });
}

// 🐨 é o emoji padrão do Umbler quando nenhum emoji foi definido — tratamos como ausente.
function formatTagLabel(tag: { name: string; emoji: string | null }): string {
  const emoji = tag.emoji && tag.emoji !== "🐨" ? tag.emoji : null;
  return emoji ? `${emoji} ${tag.name}` : tag.name;
}

// Registra no histórico da conversa quais etiquetas do WhatsApp foram
// adicionadas/removidas. Não loga nada se added/removed vierem vazios.
async function logTagChangeMessage(
  conversationId: string,
  added: { name: string; emoji: string | null }[],
  removed: { name: string; emoji: string | null }[],
) {
  if (added.length === 0 && removed.length === 0) return;

  const parts: string[] = [];
  if (added.length > 0) parts.push(`+ ${added.map(formatTagLabel).join(", ")}`);
  if (removed.length > 0) parts.push(`- ${removed.map(formatTagLabel).join(", ")}`);

  await db.insert(whatsappMessages).values({
    conversationId,
    direction: "outbound",
    type: "system",
    content: `🏷️ Etiquetas atualizadas: ${parts.join(" | ")}`,
    status: "sent",
    sentAt: new Date(),
    rawPayload: {
      kind: "tag_change",
      added: added.map((t) => t.name),
      removed: removed.map((t) => t.name),
    },
  });
}

// Registra que o contato voltou a escrever — seja porque nunca havia
// conversado antes, seja porque a conversa estava fechada.
async function logConversationStartedMessage(conversationId: string) {
  await db.insert(whatsappMessages).values({
    conversationId,
    direction: "outbound",
    type: "system",
    content: "🆕 Contato iniciou uma nova conversa",
    status: "sent",
    sentAt: new Date(),
    rawPayload: { kind: "conversation_started" },
  });
}

// Transferir para um canal = entregar ao atendente dono desse canal, com o
// canal vinculado. Assim a conversa passa a aparecer no inbox dele.
async function applyChannelTransfer(conversationId: string, targetChannelId: number) {
  const [channel] = await db
    .select({ userId: whatsappChannels.userId, name: whatsappChannels.name })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, targetChannelId))
    .limit(1);

  const [updated] = await db
    .update(whatsappConversations)
    .set({ channelId: targetChannelId, assignedAgentId: channel?.userId ?? null, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))
    .returning();

  return { updated: updated ?? null, channelName: channel?.name ?? null };
}

export async function transferConversation(conversationId: string, targetChannelId: number, reason?: string) {
  const { updated, channelName } = await applyChannelTransfer(conversationId, targetChannelId);
  if (updated) {
    await logTransferMessage(conversationId, `Conversa transferida para o canal ${channelName ?? "desconhecido"}.`, reason);
    await revokeStaleConversationAccess(conversationId, (userId, role) =>
      isConversationAccessibleToUser(conversationId, userId, role),
    );
  }
  return updated;
}

/** Transfere a conversa diretamente para um atendente específico, passando a usar o canal dele. */
export async function transferConversationToUser(conversationId: string, targetUserId: string, reason?: string) {
  const [targetUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, targetUserId)).limit(1);

  const targetChannelId = await getActiveChannelIdByUserId(targetUserId);
  if (!targetChannelId) {
    throw new Error("Atendente não possui canal de WhatsApp configurado");
  }

  const { updated } = await applyChannelTransfer(conversationId, targetChannelId);
  if (updated) {
    await logTransferMessage(conversationId, `Conversa transferida para ${targetUser?.name ?? "o atendente"}.`, reason);
    await revokeStaleConversationAccess(conversationId, (userId, role) =>
      isConversationAccessibleToUser(conversationId, userId, role),
    );
  }
  return updated;
}

/**
 * Transfere a conversa para um setor (fila) sem atribuir a um atendente
 * específico — por isso zera assignedAgentId. Sem isso, o atendente que
 * estava com a conversa antes da transferência continuaria enxergando-a
 * para sempre (vendorScopeCondition dá acesso a conversas atribuídas
 * diretamente, independente do setor/canal atual).
 */
export async function transferConversationToSector(conversationId: string, sectorId: string, reason?: string) {
  const [sector] = await db
    .select({ name: whatsappSectors.name })
    .from(whatsappSectors)
    .where(eq(whatsappSectors.id, sectorId))
    .limit(1);

  const [updated] = await db
    .update(whatsappConversations)
    .set({ sectorId, assignedAgentId: null, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))
    .returning();

  if (updated) {
    await logTransferMessage(conversationId, `Conversa transferida para o setor ${sector?.name ?? "desconhecido"}.`, reason);
    await revokeStaleConversationAccess(conversationId, (userId, role) =>
      isConversationAccessibleToUser(conversationId, userId, role),
    );
  }
  return updated ?? null;
}

export async function closeConversation(conversationId: string, userId: string) {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [updated] = await db
    .update(whatsappConversations)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId))
    .returning();

  await db.insert(whatsappMessages).values({
    conversationId,
    direction: "outbound",
    type: "system",
    content: `🔒 Atendimento encerrado por ${user?.name ?? "atendente"}`,
    status: "sent",
    sentAt: new Date(),
  });

  return updated ?? null;
}

export async function reopenConversation(conversationId: string) {
  const [updated] = await db
    .update(whatsappConversations)
    .set({ status: "open", updatedAt: new Date() })
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

export async function updateQuickReply(userId: string, id: string, title: string, content: string) {
  try {
    const [row] = await db
      .update(waQuickReplies)
      .set({ title, content })
      .where(and(eq(waQuickReplies.id, id), eq(waQuickReplies.userId, userId)))
      .returning();
    return row ?? null;
  } catch (err: unknown) {
    // Mesmo conflito de wa_quick_replies_user_title_unique que createQuickReply
    // já trata via onConflictDoNothing — aqui vira UPDATE, então precisa
    // capturar o erro do Postgres manualmente (ver padrão em
    // whatsapp-conversations.service.ts:1781).
    if ((err as { code?: string }).code === "23505") {
      throw new Error("DUPLICATE_TITLE");
    }
    throw err;
  }
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
  pagination: { cursor?: Cursor | null; limit?: number } = {},
  status?: "open" | "closed",
  filters: {
    sectorIds?: string[];
    attendantId?: string;
    channelIds?: number[];
    dateFrom?: string;
    dateTo?: string;
  } = {},
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

  const limit = clampLimit(pagination.limit, { fallback: 20, max: 100 });
  const cursor = pagination.cursor ?? null;

  const conditions: ReturnType<typeof eq>[] = [];

  if (status === "closed") {
    conditions.push(eq(whatsappConversations.status, "closed"));
  } else if (status === "open") {
    // "Abertas" inclui qualquer status que não seja "closed" (ex.: conversas
    // em espera marcadas por um nó "set_waiting" do bot, que usam valores
    // customizados como "waiting" em vez de "open").
    conditions.push(ne(whatsappConversations.status, "closed") as ReturnType<typeof eq>);
  }

  // Conversa é unificada por cliente; o vendedor vê as conversas atribuídas a ele
  // (assignedAgentId), as dos setores de atendimento aos quais pertence, e,
  // quando não há atribuição nem setor, as dos clientes sob sua responsabilidade.
  if (userRole === "vendedor" && userId) {
    const scope = await vendorScopeCondition(userId);
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

  if (filters.sectorIds && filters.sectorIds.length > 0) {
    // "__none__" filtra conversas sem setor (mesmo padrão do filtro de
    // etiquetas) — útil para admin/gerente triarem manualmente contatos novos
    // que ainda não caíram em nenhum setor.
    const realSectorIds = filters.sectorIds.filter((id) => id !== "__none__");
    const includeNoSector = filters.sectorIds.includes("__none__");

    if (realSectorIds.length > 0 && includeNoSector) {
      conditions.push(
        or(
          inArray(whatsappConversations.sectorId, realSectorIds),
          isNull(whatsappConversations.sectorId),
        ) as unknown as ReturnType<typeof eq>,
      );
    } else if (realSectorIds.length > 0) {
      conditions.push(
        inArray(whatsappConversations.sectorId, realSectorIds) as unknown as ReturnType<typeof eq>,
      );
    } else if (includeNoSector) {
      conditions.push(isNull(whatsappConversations.sectorId) as unknown as ReturnType<typeof eq>);
    }
  }

  if (filters.attendantId) {
    // Atendente = assignedAgentId (transferência explícita/bot) OU, na ausência
    // dele, clients.responsavelId (dono no CRM) — mesma regra de posse usada em
    // vendorScopeCondition. Sem o fallback, o filtro só bate com as raríssimas
    // conversas transferidas explicitamente (1 em 118 no banco hoje).
    conditions.push(
      or(
        eq(whatsappConversations.assignedAgentId, filters.attendantId),
        and(isNull(whatsappConversations.assignedAgentId), eq(clients.responsavelId, filters.attendantId)),
      ) as unknown as ReturnType<typeof eq>,
    );
  }

  if (filters.channelIds && filters.channelIds.length > 0) {
    conditions.push(
      inArray(whatsappConversations.channelId, filters.channelIds) as unknown as ReturnType<typeof eq>,
    );
  }

  // "Data" filtra pela última mensagem (lastMsgSub.lastAt), o mesmo campo já
  // exibido/ordenado na lista — não pela criação da conversa. dateTo cobre o
  // dia inteiro (< início do dia seguinte). lastAt é UTC-naive e SP é UTC-3
  // fixo (sem horário de verão desde 2019), então a borda do dia calendário
  // em SP cai 3h depois da meia-noite UTC — mesmo padrão de SP_OFFSET_HOURS
  // usado em restaurant-reports.service.ts.
  if (filters.dateFrom) {
    conditions.push(
      gte(lastMsgSub.lastAt, sql`${filters.dateFrom}::date + interval '3 hours'`) as unknown as ReturnType<typeof eq>,
    );
  }

  if (filters.dateTo) {
    conditions.push(
      lt(lastMsgSub.lastAt, sql`${filters.dateTo}::date + interval '1 day' + interval '3 hours'`) as unknown as ReturnType<typeof eq>,
    );
  }

  if (cursor) {
    const cursorCondition =
      cursor.at !== null
        ? or(
            and(
              isNotNull(lastMsgSub.lastAt),
              sql`(${lastMsgSub.lastAt}, ${whatsappConversations.id}) < (${cursor.at}::timestamp, ${cursor.id})`,
            ),
            isNull(lastMsgSub.lastAt),
          )
        : and(isNull(lastMsgSub.lastAt), sql`${whatsappConversations.id} < ${cursor.id}`);
    conditions.push(cursorCondition as unknown as ReturnType<typeof eq>);
  }

  const responsavelUsers = alias(users, "responsavel_users");

  const rows = await db
    .with(readsSub, unreadSub, lastMsgSub)
    .select({
      conversationId: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
      clientName: clients.name,
      contactName: whatsappConversations.contactName,
      contactPhotoUrl: whatsappConversations.contactPhotoUrl,
      lastMessageAt: lastMsgSub.lastAt,
      lastMessageContent: lastMsgSub.lastContent,
      lastMessageDirection: lastMsgSub.lastDirection,
      lastMessageType: lastMsgSub.lastType,
      unreadCount: sql<number>`coalesce(${unreadSub.unreadCount}, 0)`,
      channelId: whatsappConversations.channelId,
      channelName: whatsappChannels.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
      channelConnectionStatus: whatsappChannels.connectionStatus,
      channelProvider: whatsappChannels.provider,
      sectorId: whatsappConversations.sectorId,
      sectorName: whatsappSectors.name,
      sectorColor: whatsappSectors.color,
      status: whatsappConversations.status,
      responsavelId: clients.responsavelId,
      responsavelName: responsavelUsers.name,
      whatsappOptOut: clients.whatsappOptOut,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .leftJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .leftJoin(whatsappSectors, eq(whatsappConversations.sectorId, whatsappSectors.id))
    .leftJoin(lastMsgSub, eq(whatsappConversations.id, lastMsgSub.conversationId))
    .leftJoin(unreadSub, eq(whatsappConversations.id, unreadSub.conversationId))
    .leftJoin(responsavelUsers, eq(clients.responsavelId, responsavelUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${lastMsgSub.lastAt} DESC NULLS LAST`, desc(whatsappConversations.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          at: lastRow.lastMessageAt ? lastRow.lastMessageAt.toISOString() : null,
          id: lastRow.conversationId,
        })
      : null;

  const clientIds = pageRows.map((r) => r.clientId).filter((id): id is string => !!id);

  const tagsByClient = new Map<string, { id: string; name: string; color: string | null; type: string; createdAt: Date }[]>();
  const whatsappTagsByClient = new Map<string, { id: string; name: string; emoji: string | null; color: string | null; createdAt: Date }[]>();

  if (clientIds.length > 0) {
    const tagsData = await db
      .select({
        clientId: contactTags.clientId,
        id: tags.id,
        name: tags.name,
        color: tags.color,
        type: tags.type,
        createdAt: contactTags.createdAt,
      })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(inArray(contactTags.clientId, clientIds))
      .orderBy(desc(contactTags.createdAt));

    for (const row of tagsData) {
      if (!row.clientId) continue;
      const list = tagsByClient.get(row.clientId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color, type: row.type, createdAt: row.createdAt });
      tagsByClient.set(row.clientId, list);
    }

    const waTagsData = await db
      .select({
        clientId: contactTags.clientId,
        id: whatsappTags.id,
        name: whatsappTags.name,
        emoji: whatsappTags.emoji,
        color: whatsappTags.color,
        createdAt: contactTags.createdAt,
      })
      .from(contactTags)
      .innerJoin(whatsappTags, eq(contactTags.whatsappTagId, whatsappTags.id))
      .where(inArray(contactTags.clientId, clientIds))
      .orderBy(desc(contactTags.createdAt));

    for (const row of waTagsData) {
      if (!row.clientId) continue;
      const list = whatsappTagsByClient.get(row.clientId) ?? [];
      list.push({ id: row.id, name: row.name, emoji: row.emoji, color: row.color, createdAt: row.createdAt });
      whatsappTagsByClient.set(row.clientId, list);
    }
  }

  return {
    items: pageRows.map((row) => ({
      ...row,
      tags: row.clientId ? (tagsByClient.get(row.clientId) ?? []) : [],
      whatsappTags: row.clientId ? (whatsappTagsByClient.get(row.clientId) ?? []) : [],
    })),
    nextCursor,
  };
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
    const scope = await vendorScopeCondition(userId);
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
      contactName: whatsappConversations.contactName,
      contactPhotoUrl: whatsappConversations.contactPhotoUrl,
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
    const scope = await vendorScopeCondition(userId);
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
  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId, userId);

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
    .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
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
      publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return { waMessageId };
  } catch (err) {
    console.error(`[WA Conversations Service] Erro no envio:`, err);
    throw err;
  }
}

/**
 * Adiciona uma nota interna à conversa — visível apenas para atendentes, nunca
 * enviada ao contato pelo WhatsApp. Reaproveita a tabela whatsapp_messages
 * (type: "note") para que a nota apareça inline no histórico da conversa.
 */
export async function addConversationNote(
  conversationId: string,
  content: string,
  userId: string,
  userRole: string,
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = await vendorScopeCondition(userId);
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({
      id: whatsappConversations.id,
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

  const [savedNote] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      direction: "outbound",
      type: "note",
      content,
      sentByUserId: userId,
      sentAt: new Date(),
    })
    .returning({ id: whatsappMessages.id });

  await db
    .update(whatsappConversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });

  return { id: savedNote.id };
}

/**
 * Lista todas as notas internas de uma conversa (mais recente primeiro), para
 * o banner fixado no topo do chat e o modal "ver mais".
 */
export async function listConversationNotes(
  conversationId: string,
  userId: string,
  userRole: string,
) {
  const whereConditions: ReturnType<typeof eq>[] = [
    eq(whatsappConversations.id, conversationId),
  ];
  if (userRole === "vendedor") {
    const scope = await vendorScopeCondition(userId);
    if (scope) whereConditions.push(scope);
  }

  const [conv] = await db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) return null;

  return db
    .select({
      id: whatsappMessages.id,
      content: whatsappMessages.content,
      createdAt: whatsappMessages.createdAt,
      authorName: users.name,
    })
    .from(whatsappMessages)
    .leftJoin(users, eq(whatsappMessages.sentByUserId, users.id))
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.type, "note"),
      ),
    )
    .orderBy(desc(whatsappMessages.createdAt));
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
    const scope = await vendorScopeCondition(userId);
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

  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId, userId);

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
    .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
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
      publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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
    const scope = await vendorScopeCondition(userId);
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

  const resolvedChannel = await resolveOutboundChannel(conversationId, channelId, userId);

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

  // Guardamos uma cópia própria no R2 no momento do envio: canais Evolution/Baileys
  // nunca retornam um handle de mídia reutilizável (o buffer seria perdido depois do
  // envio), e o handle da Meta expira — sem isso a mídia enviada dependeria só de
  // terceiros e ficaria quebrada permanentemente assim que o handle/URL expirasse.
  let storageKey: string | null = null;
  try {
    storageKey = await uploadWhatsappMedia(effectiveBuffer, effectiveMime);
  } catch (err) {
    console.error(`[sendConversationMedia] falha ao cachear mídia no R2:`, err);
  }

  await db
    .insert(whatsappMedia)
    .values({
      messageId: savedMessage.id,
      whatsappMediaId: waMediaId,
      storageKey,
      mimeType: effectiveMime,
      filename: effectiveName,
      size: effectiveBuffer.length,
    });

  await db
    .update(whatsappConversations)
    .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  if (conv.id) {
    publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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
    const scope = await vendorScopeCondition(userId);
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
        publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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
      publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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
  /** Nome de exibição do WhatsApp (Baileys pushName) — usado para enriquecer conversas sem cliente vinculado. */
  pushName?: string;
  /** Nome da instância Baileys — necessário para buscar a foto de perfil via socket ativo (canal QR Code). */
  instanceName?: string;
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

  const conv = await findOrCreateConversation(data.phone, data.channelId, data.pushName);

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

  // Detecta a transição closed→open com um UPDATE condicionado ao status
  // atual (em vez de um SELECT prévio + UPDATE separado): se dois webhooks
  // para a mesma conversa fechada chegarem quase ao mesmo tempo, o Postgres
  // serializa as duas escritas na linha e só uma delas vê status = 'closed'
  // e recebe a linha de volta — evita logar "nova conversa" duas vezes.
  const [reopened] = await db
    .update(whatsappConversations)
    .set({ status: "open" })
    .where(and(eq(whatsappConversations.id, conv.id), eq(whatsappConversations.status, "closed")))
    .returning({ id: whatsappConversations.id });

  // Atualiza o "último canal usado" da conversa para refletir por onde o cliente
  // escreveu por último — usado como canal padrão de resposta.
  await db
    .update(whatsappConversations)
    .set({
      status: "open",
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      ...(data.channelId != null ? { channelId: data.channelId } : {}),
    })
    .where(eq(whatsappConversations.id, conv.id));

  if (data.channelId != null) {
    await backfillSectorFromChannel(conv.id, data.channelId);
  }

  // Só loga "iniciou conversa" para mensagens que vieram de fato do contato —
  // não quando o vendedor reabre a conversa escrevendo pelo próprio celular
  // (direction "outbound" via _fromMe do Evolution/Baileys).
  const isBrandNew = (conv as { _wasCreated?: boolean })._wasCreated === true;
  if (direction === "inbound" && (reopened || isBrandNew)) {
    await logConversationStartedMessage(conv.id);
  }

  // Enriquece conversas de contatos ainda sem cliente vinculado com nome/foto
  // do WhatsApp — só se aplica quando não há clientId (a UI usa clients.name
  // como fonte de verdade quando há cliente casado).
  if (!conv.clientId) {
    const updates: Partial<typeof whatsappConversations.$inferInsert> = {};

    if (data.pushName && data.pushName !== (conv as { contactName?: string | null }).contactName) {
      updates.contactName = data.pushName;
    }

    // Foto só é buscada na criação da conversa — evita round-trip de rede ao
    // socket Baileys a cada mensagem do mesmo contato desconhecido.
    if (isBrandNew && data.instanceName) {
      const photoUrl = await fetchProfilePictureUrl(data.instanceName, data.phone).catch(() => null);
      if (photoUrl) updates.contactPhotoUrl = photoUrl;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(whatsappConversations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(whatsappConversations.id, conv.id));
    }
  }

  console.log(
    `[WA Webhook] Inbound de ${data.phone} → conversa: ${conv.id} (cliente: ${conv.clientId ?? "não encontrado"})`,
  );

  // Chaveado por conversationId, igual ao conversationKey do frontend — um
  // mesmo cliente pode ter várias conversas paralelas (uma por canal/atendente),
  // então publicar por clientId vazaria o evento entre elas.
  publishConversationEvent(conv.id, "new_message", {
    clientId: conv.clientId ?? null,
  });

  publishSseEvent("new_whatsapp_inbound", { conversationId: conv.id, clientId: conv.clientId ?? null });
}

export async function getMediaById(id: string) {
  const [media] = await db
    .select({
      id: whatsappMedia.id,
      messageId: whatsappMedia.messageId,
      whatsappMediaId: whatsappMedia.whatsappMediaId,
      storageKey: whatsappMedia.storageKey,
      mimeType: whatsappMedia.mimeType,
      filename: whatsappMedia.filename,
      size: whatsappMedia.size,
      createdAt: whatsappMedia.createdAt,
      channelId: whatsappMessages.channelId,
      conversationId: whatsappMessages.conversationId,
    })
    .from(whatsappMedia)
    .leftJoin(whatsappMessages, eq(whatsappMedia.messageId, whatsappMessages.id))
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
    publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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
    const scope = await vendorScopeCondition(userId);
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

  // Canal explícito (override do admin/gerente via seletor) tem prioridade;
  // senão usa sempre o canal atual da conversa — igual ao texto/mídia/template,
  // sem preferir o canal pessoal do atendente. Se o remetente for vendedor,
  // valida que o canal pedido está no escopo dele antes de usar suas
  // credenciais — evita reagir "no nome" de um canal alheio.
  let channelOverride = null;
  if (channelId != null) {
    let allowed = true;
    if (userRole === "vendedor") {
      const allowedChannelIds = await listChannelIdsForUser(userId);
      allowed = allowedChannelIds.includes(channelId);
    }
    if (allowed) {
      const ch = await getChannelById(channelId).catch(() => null);
      if (ch && ch.phoneNumberId && ch.accessToken) channelOverride = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
    }
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
    publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
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

  // Usa o canal ativo do atendente que está iniciando a conversa, para que
  // fique isolada das conversas de outros atendentes com o mesmo contato.
  const channelId = await getActiveChannelIdByUserId(userId);
  const conv = await findOrCreateConversation(client.phone, channelId);

  // Sempre grava o clientId escolhido pelo atendente, mesmo que a conversa já
  // tivesse um clientId diferente (ex.: telefone só foi conciliado depois que
  // a conversa foi criada por um bot/campanha) — evita conversas que ficam
  // presas a um vínculo desatualizado.
  if (conv.clientId !== clientId) {
    await db
      .update(whatsappConversations)
      .set({ clientId, updatedAt: new Date() })
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
  // Lê o estado atual ANTES de apagar, para poder calcular o diff depois.
  const currentRows = await db
    .select({ id: whatsappTags.id, name: whatsappTags.name, emoji: whatsappTags.emoji })
    .from(contactTags)
    .innerJoin(whatsappTags, eq(contactTags.whatsappTagId, whatsappTags.id))
    .where(eq(contactTags.clientId, clientId));

  const currentIds = new Set(currentRows.map((t) => t.id));
  const newIds = new Set(whatsappTagIds);
  const removedTags = currentRows.filter((t) => !newIds.has(t.id));

  await db
    .delete(contactTags)
    .where(and(eq(contactTags.clientId, clientId), isNotNull(contactTags.whatsappTagId)));
  if (whatsappTagIds.length > 0) {
    await db
      .insert(contactTags)
      .values(whatsappTagIds.map((whatsappTagId) => ({ clientId, whatsappTagId })));
  }

  const addedIds = whatsappTagIds.filter((id) => !currentIds.has(id));
  const addedTags =
    addedIds.length > 0
      ? await db
          .select({ id: whatsappTags.id, name: whatsappTags.name, emoji: whatsappTags.emoji })
          .from(whatsappTags)
          .where(inArray(whatsappTags.id, addedIds))
      : [];

  if (addedTags.length === 0 && removedTags.length === 0) return; // nada mudou

  const conversationId = await resolveConversationIdByClientId(clientId);
  if (!conversationId) return; // contato sem conversa de WhatsApp ainda

  await logTagChangeMessage(conversationId, addedTags, removedTags);
  publishConversationEvent(conversationId, "new_message", { clientId });
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
