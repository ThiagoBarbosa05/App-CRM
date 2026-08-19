import { db } from "../db";
import {
  clients,
  whatsappChannels,
  whatsappConversations,
  whatsappMessages,
  whatsappMedia,
  whatsappConversationReads,
  whatsappConversationPerspectiveStates,
  whatsappReactions,
  waSavedStickers,
  waQuickReplies,
  contactTags,
  tags,
  whatsappTags,
  whatsappSectors,
  whatsappSectorMembers,
  users,
} from "../../shared/schema";
import { eq, and, ilike, or, desc, sql, asc, inArray, isNotNull, isNull, ne, gte, lt, type SQL, type SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { sendTextMessage, sendTemplateMessage, uploadMedia, sendMediaMessage, sendReaction, downloadMediaToBuffer } from "../integrations/whatsapp";
import { sendText as evoSendText, sendMedia as evoSendMedia, sendReaction as evoSendReaction, normalizeToJid, fetchProfilePictureUrl } from "../integrations/evolution";
import { uploadWhatsappMedia, getPublicR2Url, getWhatsappMediaObject, deleteR2Object } from "../lib/r2";
import { getTemplateMedia, fetchMetaTemplates } from "./whatsapp-templates.service";
import { publishConversationEvent, publishSseEvent, revokeStaleConversationAccess } from "../lib/sse-hub";
import { getChannelById, resolveChannelForConversation, resolveChannelById, getActiveChannelIdByUserId, listChannelIdsForUser, getDefaultSectorIdForChannel, getChannelByPhone, getChannelIdentityById, isSameChannelPhone } from "./whatsapp-channels.service";
import type { ResolvedChannel, ChannelIdentity } from "./whatsapp-channels.service";
import { listSectorIdsForUser } from "./whatsapp-sectors.service";
import { remuxWebmOpusToOgg } from "../lib/webm-opus-to-ogg";
import { Cursor, clampLimit, encodeCursor } from "../lib/cursor-pagination";
import { SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES } from "../lib/whatsapp-message-status";

// Reexportado do util compartilhado para não quebrar imports existentes
// (whatsapp-opt-out.service.ts, bot-session-history.controller.ts).
import { normalizePhone, canonicalPhone, phoneVariants } from "../lib/phone";
export { normalizePhone };

// Escopo de visibilidade de um vendedor sobre conversas de WhatsApp: conversas
// atribuídas a ele e conversas da fila de setor (setor = fila; transferir
// para um setor sem escolher atendente deixa a conversa visível aos membros
// dele). A visibilidade pela fila exige setor E canal permitidos — um vendedor
// só vê a fila de um setor nos canais aos quais também tem acesso (ex: setor
// "Suporte" recebe em vários números, mas o atendente só vê o que chegou pelos
// números dele). Conversas já atribuídas diretamente continuam sempre visíveis,
// independente de canal — isso é posse, não fila. Ser "responsável" do
// cliente no CRM NÃO dá acesso à conversa por si só (isso vale só para a
// busca de cliente ao iniciar uma conversa nova, ver isClientAccessibleToUser)
// — receber mensagem de um contato que não é "seu" no CRM é esperado.
/**
 * Diálogo interno cujo OUTRO lado é um dos canais em `channelIds`. A conversa
 * canônica de um diálogo canal↔canal pertence a um só dos dois canais
 * (`channelId`), e o outro fica em `peerChannelId` — sem esta cláusula, quem só
 * tem acesso ao canal peer nunca bateria na regra normal de setor+canal e não
 * veria a conversa. Um cliente externo nunca tem `peerChannelId`, então isso
 * não afeta a visibilidade de conversas normais.
 */
function conversationAddressedToOwnChannel(channelIds: number[]): SQL | undefined {
  if (channelIds.length === 0) return undefined;
  return inArray(whatsappConversations.peerChannelId, channelIds) as SQL;
}

/** Mesma exceção que `conversationAddressedToOwnChannel`, mas resolvendo os
 * canais pelo setor padrão deles em vez de por id — usado quando o filtro
 * explícito da UI é só por setor (sem canal selecionado). */
function conversationAddressedToOwnChannelInSectors(sectorIds: string[]): SQL | undefined {
  if (sectorIds.length === 0) return undefined;
  // inArray() em vez de `= ANY(${array})` — ver nota em conversationPhoneCondition.
  // A condição do IN é montada separadamente e "splicada" dentro do EXISTS: o
  // template `sql` do drizzle intercala objetos SQL aninhados como fragmentos
  // de query, então isso continua sendo uma única query parametrizada.
  const sectorMatch = inArray(sql`wc.default_sector_id`, sectorIds);
  return sql`EXISTS (
    SELECT 1 FROM ${whatsappChannels} wc
    WHERE wc.id = ${whatsappConversations.peerChannelId}
      AND ${sectorMatch}
  )`;
}

async function vendorScopeCondition(userId: string) {
  const [sectorIds, channelIds] = await Promise.all([
    listSectorIdsForUser(userId),
    listChannelIdsForUser(userId),
  ]);
  const clauses: (SQL<unknown> | undefined)[] = [eq(whatsappConversations.assignedAgentId, userId)];
  if (sectorIds.length > 0 && channelIds.length > 0) {
    clauses.push(
      and(
        inArray(whatsappConversations.sectorId, sectorIds),
        inArray(whatsappConversations.channelId, channelIds),
      ),
    );
  }
  if (channelIds.length > 0) {
    // Conversa no meu canal que ainda não caiu em setor nenhum é minha: sem
    // isso ela fica invisível a TODO vendedor (a regra acima exige setor E
    // canal) — acontece sempre que o canal não tem default_sector_id, quando a
    // conversa nasce de bot/campanha, ou quando o setor é apagado
    // (deleteSector zera sector_id para preservar a conversa).
    clauses.push(and(inArray(whatsappConversations.channelId, channelIds), isNull(whatsappConversations.sectorId)));
    clauses.push(conversationAddressedToOwnChannel(channelIds));
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

/**
 * Reduz um diálogo interno entre DOIS canais nossos a uma chave determinística
 * e simétrica: `canonicalInternalPair(a, b)` e `canonicalInternalPair(b, a)`
 * devolvem o mesmo resultado. O dono da conversa é sempre o canal de menor id,
 * e o telefone da conversa é o número do outro canal.
 *
 * É isso que faz o diálogo virar UMA conversa em vez de duas espelhadas. Antes,
 * cada lado criava a sua linha e — como `whatsapp_messages.wa_message_id` é
 * unique global e o WhatsApp usa o mesmo id nas duas pontas — cada mensagem era
 * gravada em apenas uma delas: os dois atendentes viam metade do histórico.
 *
 * Pura (sem DB) para ser testável isoladamente.
 */
export function canonicalInternalPair(
  a: { id: number; displayPhone: string | null },
  b: { id: number; displayPhone: string | null },
): { ownerChannelId: number; peerChannelId: number; phone: string | null } {
  const [owner, peer] = a.id <= b.id ? [a, b] : [b, a];
  return { ownerChannelId: owner.id, peerChannelId: peer.id, phone: peer.displayPhone };
}

/**
 * Nome a exibir no lugar do contato quando o outro lado da conversa é um canal
 * nosso. A conversa interna é única e pertence a um dos dois canais, então o
 * "outro lado" depende de quem está olhando: o atendente do canal dono lê o
 * nome do peer, o atendente do canal peer lê o nome do dono. Quem não é de
 * nenhum dos dois (admin/gerente) lê o peer, que é o interlocutor do ponto de
 * vista da conversa.
 *
 * Prioriza o nome do ATENDENTE dono do canal (`whatsapp_channels.userId →
 * users.name`) — é o que a pessoa reconhece, não o nome interno do canal. Cai
 * para o nome do canal quando ele não tem dono definido (canal de equipe,
 * compartilhado por vários atendentes via whatsapp_channel_members). Pura,
 * para ser testável isoladamente.
 */
/**
 * True quando o usuário logado é do lado PEER da conversa (e não do dono) —
 * a mesma regra usada tanto para decidir o rótulo (`internalPeerLabel`) quanto
 * para traduzir `direction`/reações para o referencial de quem está lendo
 * (`directionForViewer`). Extraída à parte para as duas nunca divergirem.
 * Conversa externa (`peerChannelId` null) nunca tem "lado peer" — sempre false.
 */
export function viewerIsPeerSide(
  row: { channelId: number | null; peerChannelId: number | null },
  viewerChannelIds: number[],
): boolean {
  if (row.peerChannelId == null) return false;
  return (
    viewerChannelIds.includes(row.peerChannelId) &&
    (row.channelId == null || !viewerChannelIds.includes(row.channelId))
  );
}

export function internalPeerLabel(
  row: {
    channelId: number | null;
    peerChannelId: number | null;
    channelName: string | null;
    channelUserName: string | null;
    peerChannelName: string | null;
    peerChannelUserName: string | null;
  },
  viewerChannelIds: number[],
): string | null {
  if (row.peerChannelId == null) return null;
  return viewerIsPeerSide(row, viewerChannelIds)
    ? (row.channelUserName ?? row.channelName)
    : (row.peerChannelUserName ?? row.peerChannelName);
}

/**
 * `direction` no banco é sempre relativa ao canal DONO da conversa (ver
 * `canonicalInternalPair`/`resolveMessageDirection`) — necessário porque a
 * linha é única e compartilhada pelos dois lados. Só que toda a UI trata
 * `direction` como relativa a QUEM ESTÁ LENDO ("outbound" = bolha à direita,
 * "é minha"). Para o atendente do lado dono os dois referenciais coincidem;
 * para o atendente do lado peer, invertidos — sem isso as bolhas aparecem
 * trocadas, o prefixo "Você:" some do lado errado, e a reconciliação otimista
 * do frontend (que só casa contra mensagens "outbound") nunca encontra a
 * mensagem real, deixando a bolha local presa. Pura.
 */
export function directionForViewer(
  direction: "inbound" | "outbound",
  viewerIsPeer: boolean,
): "inbound" | "outbound" {
  if (!viewerIsPeer) return direction;
  return direction === "outbound" ? "inbound" : "outbound";
}

/**
 * Uma mensagem conta como "recebida não-lida" para o leitor quando, no
 * referencial DELE, ela é inbound. `whatsapp_messages.direction` é gravada
 * relativa ao canal DONO da conversa (ver `directionForViewer`), então a
 * contagem de não-lidas precisa traduzir para o leitor — senão, num diálogo
 * interno canal↔canal, o atendente do lado peer não recebe badge das mensagens
 * do outro lado (gravadas "outbound") e ganha badge fantasma das próprias
 * (gravadas "inbound"). Pura, e reusa `viewerIsPeerSide`/`directionForViewer`
 * para nunca divergir da tradução usada na renderização. A condição SQL em
 * `listClientsForChat` espelha exatamente esta função.
 */
export function messageIsUnreadIncoming(
  row: { channelId: number | null; peerChannelId: number | null },
  messageDirection: "inbound" | "outbound",
  viewerChannelIds: number[],
): boolean {
  return directionForViewer(messageDirection, viewerIsPeerSide(row, viewerChannelIds)) === "inbound";
}

/**
 * Decide se um admin/gerente pode "espiar" um diálogo interno pela perspectiva
 * de um dos lados do par (ver getConversation). Retorna o channelId a usar como
 * referencial do leitor, ou null quando o override não se aplica — caindo então
 * na perspectiva derivada dos próprios canais do usuário. O override só vale
 * quando: o papel é admin/gerente, a conversa é interna (tem peerChannelId) e o
 * asChannelId pedido é EXATAMENTE um dos dois canais do par. Pura, para ser
 * testável sem banco.
 *
 * Também reusada por markConversationRead para decidir o perspectiveChannelId
 * da marcação de leitura — a mesma regra que autoriza a perspectiva de LEITURA
 * autoriza a de GRAVAÇÃO, então as duas nunca podem divergir sobre qual
 * asChannelId é legítimo.
 */
export function resolvePerspectiveOverride(
  userRole: string,
  row: { channelId: number | null; peerChannelId: number | null },
  asChannelId: number | undefined,
): number | null {
  const canOverride = userRole === "admin" || userRole === "gerente";
  if (
    canOverride &&
    row.peerChannelId != null &&
    asChannelId != null &&
    (asChannelId === row.channelId || asChannelId === row.peerChannelId)
  ) {
    return asChannelId;
  }
  return null;
}

async function getConversationSides(conversationId: string) {
  const [conversation] = await db
    .select({
      id: whatsappConversations.id,
      phone: whatsappConversations.phone,
      channelId: whatsappConversations.channelId,
      peerChannelId: whatsappConversations.peerChannelId,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);
  return conversation ?? null;
}

async function resolveOperationalPerspective(
  conversationId: string,
  userId: string,
  userRole: string,
  asChannelId?: number,
) {
  const conversation = await getConversationSides(conversationId);
  if (!conversation) return null;
  if (conversation.peerChannelId == null || conversation.channelId == null) {
    return { conversation, perspectiveChannelId: null };
  }

  const override = resolvePerspectiveOverride(userRole, conversation, asChannelId);
  if (override != null) {
    return { conversation, perspectiveChannelId: override };
  }

  if (userRole === "admin" || userRole === "gerente") {
    throw new Error("PERSPECTIVE_CHANNEL_REQUIRED");
  }

  const userChannelIds = await listChannelIdsForUser(userId);
  const isOwner = userChannelIds.includes(conversation.channelId);
  const isPeer = userChannelIds.includes(conversation.peerChannelId);
  if (isPeer && !isOwner) {
    return { conversation, perspectiveChannelId: conversation.peerChannelId };
  }
  if (isOwner) {
    return { conversation, perspectiveChannelId: conversation.channelId };
  }
  throw new Error("PERSPECTIVE_CHANNEL_NOT_ACCESSIBLE");
}

async function setPerspectiveStatus(
  conversationId: string,
  channelId: number,
  status: "open" | "closed",
  userId?: string,
) {
  const now = new Date();
  const [state] = await db
    .insert(whatsappConversationPerspectiveStates)
    .values({
      conversationId,
      channelId,
      status,
      closedAt: status === "closed" ? now : null,
      closedBy: status === "closed" ? (userId ?? null) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        whatsappConversationPerspectiveStates.conversationId,
        whatsappConversationPerspectiveStates.channelId,
      ],
      set: {
        status,
        closedAt: status === "closed" ? now : null,
        closedBy: status === "closed" ? (userId ?? null) : null,
        updatedAt: now,
      },
    })
    .returning();
  return state;
}

async function reopenActivePerspective(
  conversationId: string,
  channelId: number | null | undefined,
) {
  if (channelId == null) return false;
  const conversation = await getConversationSides(conversationId);
  if (
    !conversation ||
    conversation.peerChannelId == null ||
    (channelId !== conversation.channelId && channelId !== conversation.peerChannelId)
  ) {
    return false;
  }
  const [reopened] = await db
    .update(whatsappConversationPerspectiveStates)
    .set({
      status: "open",
      closedAt: null,
      closedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(whatsappConversationPerspectiveStates.conversationId, conversationId),
        eq(whatsappConversationPerspectiveStates.channelId, channelId),
        eq(whatsappConversationPerspectiveStates.status, "closed"),
      ),
    )
    .returning({ id: whatsappConversationPerspectiveStates.id });
  if (!reopened) {
    await db
      .insert(whatsappConversationPerspectiveStates)
      .values({ conversationId, channelId, status: "open" })
      .onConflictDoNothing();
  }
  return Boolean(reopened);
}

/**
 * Qual canal deve "assinar" o REENVIO de uma mensagem que falhou. Um retry não
 * é um envio novo: tem que sair do MESMO lado que tentou enviar da primeira
 * vez, não do lado de quem clicou em "reenviar" — senão, num diálogo interno
 * canal↔canal, a mensagem do peer volta pelo canal DONO, chega ao destinatário
 * errado e continua gravada como "inbound" (a UI segue mostrando como se fosse
 * do peer, embora o dono é que tenha enviado).
 *
 * `whatsapp_messages.channel_id` é o snapshot do canal de origem e resolve o
 * caso normal. Quando é null (linhas antigas, anteriores à coluna), cai na
 * direção: uma mensagem com status=failed só existe porque o CRM tentou
 * enviá-la, e `direction` é relativa ao dono — logo "inbound" numa conversa
 * interna significa que quem enviou foi o lado PEER. Pura, testável sem banco.
 */
export function retryActAsChannelId(
  msg: { channelId: number | null; direction: "inbound" | "outbound" },
  conv: { channelId: number | null; peerChannelId: number | null },
): number | undefined {
  if (msg.channelId != null) return msg.channelId;
  if (conv.peerChannelId != null && msg.direction === "inbound") return conv.peerChannelId;
  return conv.channelId ?? undefined;
}

/** Condição SQL que casa uma conversa pelo telefone em qualquer forma conhecida
 * (com/sem DDI 55, com/sem o 9º dígito) — pela coluna canônica quando existir e
 * pelo texto cru como fallback para linhas ainda não migradas. */
function conversationPhoneCondition(phone: string) {
  const canonical = canonicalPhone(phone);
  const variants = phoneVariants(phone);
  const clauses: (SQL<unknown> | undefined)[] = [];
  if (canonical) clauses.push(eq(whatsappConversations.phoneNormalized, canonical));
  if (variants.length > 0) {
    // inArray() (→ "IN ($1, $2, ...)") em vez de `= ANY(${array})`: o driver
    // neon-http não faz bind de um array JS como parâmetro único de ANY(),
    // gerando "op ANY/ALL (array) requires array on right side" em runtime
    // (só aparece em produção — o teste unitário local não bate no driver
    // real). inArray expande cada item como parâmetro próprio.
    clauses.push(inArray(sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g')`, variants));
  }
  return or(...clauses);
}

/**
 * Resolve a identidade canônica de uma conversa a partir do telefone do outro
 * lado e do canal que está processando a mensagem. Para um contato externo,
 * devolve os valores originais; para um diálogo interno canal↔canal, devolve o
 * par canônico (ver `canonicalInternalPair`).
 */
async function resolveConversationIdentity(phone: string, channelId?: number | null) {
  const peerChannel = await getChannelByPhone(phone).catch(() => null);
  if (!peerChannel) return { phone, channelId, peerChannelId: null as number | null };

  // Telefone é de um canal nosso, mas não há canal de origem (bot/campanha) ou
  // é o próprio canal: nada a canonicalizar, só registra o peer.
  if (channelId == null || peerChannel.id === channelId) {
    return { phone, channelId, peerChannelId: peerChannel.id === channelId ? null : peerChannel.id };
  }

  const ownChannel = await getChannelIdentityById(channelId).catch(() => null);
  if (!ownChannel) return { phone, channelId, peerChannelId: peerChannel.id };

  const pair = canonicalInternalPair(ownChannel, peerChannel);
  return {
    phone: pair.phone ?? phone,
    channelId: pair.ownerChannelId,
    peerChannelId: pair.peerChannelId,
  };
}

export async function findOrCreateConversation(phone: string, channelId?: number | null, contactName?: string) {
  const identity = await resolveConversationIdentity(phone, channelId);
  const effectivePhone = identity.phone;
  const effectiveChannelId = identity.channelId;

  const phoneCondition = conversationPhoneCondition(effectivePhone);

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
    effectiveChannelId === undefined
      ? undefined
      : effectiveChannelId === null
        ? isNull(whatsappConversations.channelId)
        : eq(whatsappConversations.channelId, effectiveChannelId);

  const findExisting = async () => {
    const [row] = await db
      .select()
      .from(whatsappConversations)
      .where(channelCondition ? and(phoneCondition, channelCondition) : phoneCondition)
      .orderBy(asc(whatsappConversations.createdAt))
      .limit(1);
    return row ?? null;
  };

  const existing = await findExisting();
  if (existing) {
    // Linha anterior à migração pode estar sem as colunas novas — completa sem
    // tocar em nada mais (o canal/telefone da conversa são imutáveis).
    if (!existing.phoneNormalized || existing.peerChannelId !== identity.peerChannelId) {
      // Linha criada antes desta identificação de par interno pode ter sido
      // vinculada por engano a um cliente cujo telefone coincidiu com o do
      // canal peer — desfaz aqui, no mesmo momento em que peerChannelId é
      // detectado pela primeira vez.
      const clearClientId = identity.peerChannelId != null && existing.clientId != null;
      await db
        .update(whatsappConversations)
        .set({
          phoneNormalized: existing.phoneNormalized ?? canonicalPhone(existing.phone),
          peerChannelId: identity.peerChannelId,
          ...(clearClientId ? { clientId: null } : {}),
        })
        .where(eq(whatsappConversations.id, existing.id));
      if (clearClientId) existing.clientId = null;
    }
    return existing;
  }

  // Diálogo interno canal↔canal nunca vira cliente: o "telefone" da conversa é
  // o número de OUTRO canal nosso, não de um contato de verdade — mesmo que,
  // por coincidência, alguém tenha cadastrado esse número como cliente.
  const matchedClient = identity.peerChannelId
    ? null
    : (
        await db
          .select({ id: clients.id })
          .from(clients)
          .where(inArray(sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g')`, phoneVariants(effectivePhone)))
          .limit(1)
      )[0];

  // Herda o setor padrão do canal (se configurado) para que a conversa não
  // nasça sem setor e, por isso, fique invisível a todo vendedor sob a regra
  // de vendorScopeCondition (setor E canal).
  const defaultSectorId = effectiveChannelId ? await getDefaultSectorIdForChannel(effectiveChannelId) : null;

  try {
    const [created] = await db
      .insert(whatsappConversations)
      .values({
        phone: effectivePhone,
        phoneNormalized: canonicalPhone(effectivePhone),
        clientId: matchedClient?.id ?? null,
        channelId: effectiveChannelId ?? null,
        peerChannelId: identity.peerChannelId,
        sectorId: defaultSectorId,
        // Nunca inventamos nome: só o pushName real do contato entra aqui. Sem
        // ele a conversa fica sem nome e a UI exibe o telefone. O rótulo de um
        // canal interno é derivado de peerChannelId na leitura, não gravado
        // aqui — assim cada atendente lê o nome do OUTRO lado, não o do próprio
        // canal.
        contactName: matchedClient || identity.peerChannelId ? null : (contactName ?? null),
      })
      .returning();

    // Flag efêmera (não é coluna do banco) usada por saveInboundMessage para
    // saber que este é o primeiro contato desse telefone, sem precisar de uma
    // segunda query.
    return { ...created, _wasCreated: true as const };
  } catch (err: unknown) {
    // Corrida com outro webhook do mesmo contato: o índice único
    // (phone_normalized, channel_id) rejeita a segunda inserção — releitura
    // devolve a conversa que o outro processo acabou de criar.
    if ((err as { code?: string }).code === "23505") {
      const raced = await findExisting();
      if (raced) return raced;
    }
    throw err;
  }
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
  const variants = phoneVariants(phone);
  if (variants.length === 0) return;

  const linked = await db
    .update(whatsappConversations)
    .set({ clientId, updatedAt: new Date() })
    .where(
      and(
        isNull(whatsappConversations.clientId),
        // Não sequestra um diálogo interno canal↔canal: aquele "telefone" é o
        // número de um canal nosso, não de um cliente.
        isNull(whatsappConversations.peerChannelId),
        inArray(sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g')`, variants),
      ),
    )
    .returning({ id: whatsappConversations.id });

  for (const row of linked) {
    publishSseEvent("new_whatsapp_inbound", { conversationId: row.id, clientId });
  }

  return linked.length;
}

// Resolve o canal de envio de uma conversa — SEMPRE o canal ao qual a conversa
// está vinculada (telefone + canal = identidade imutável da conversa). Isso
// garante isolamento estrito: cada conversa envia e recebe por um único número,
// e o outbound nunca sai por um canal diferente do da conversa.
//
// Os parâmetros `_channelId` (override) e `_requestingUserId` são mantidos por
// compatibilidade de assinatura com os chamadores, mas são IGNORADOS: honrar um
// override permitia a conversa "trocar de canal" e a resposta do contato cair na
// conversa errada. O canal é definido uma vez em findOrCreateConversation.
export async function resolveOutboundChannel(
  conversationId: string,
  _channelId?: number,
  _requestingUserId?: string,
): Promise<ResolvedChannel | null> {
  return resolveChannelForConversation(conversationId).catch(() => null);
}

/**
 * Resolve o canal E a direção de um envio a partir de QUEM está mandando —
 * necessária só para diálogos internos canal↔canal, onde `resolveOutboundChannel`
 * (sempre o canal dono) não é suficiente: os dois lados são canais nossos, e o
 * que sai por qual depende de qual dos dois atendentes está na tela.
 *
 * Sem `peerChannelId` (conversa comum, com cliente externo) o comportamento é
 * idêntico a `resolveOutboundChannel` — o isolamento estrito de canal dessas
 * conversas não muda.
 *
 * Com `peerChannelId`: se o usuário logado for do canal PEER (e não do dono),
 * a mensagem sai pelo número dele, com `direction: "inbound"` — do ponto de
 * vista da conversa (dona = o outro canal), é como se o peer tivesse acabado
 * de "chegar" nela, exatamente o que aconteceria se ele tivesse mandado a
 * mesma mensagem pelo celular físico em vez do CRM (ver `resolveMessageDirection`,
 * usado no caminho inbound real). Em qualquer outro caso — usuário é do canal
 * dono, tem acesso aos dois, ou não tem canal nenhum (admin/gerente) — mantém
 * o comportamento atual: envia pelo dono, `direction: "outbound"`.
 */
export async function resolveOutboundChannelForSender(
  conversationId: string,
  requestingUserId: string,
  /**
   * Canal pelo qual o envio deve "assinar", sobrepondo a inferência por
   * participação. Usado quando um supervisor (admin/gerente) responde pela caixa
   * de um dos lados de um diálogo interno — ex.: thiago, olhando a caixa do
   * eventos, envia PELO número do eventos. O chamador é responsável por só
   * passar isto para papéis autorizados. Ignorado se não for um dos dois canais
   * do par.
   */
  actAsChannelId?: number,
): Promise<{
  channel: ResolvedChannel;
  channelId: number;
  direction: "inbound" | "outbound";
  /**
   * Telefone de destino da chamada à API. `whatsapp_conversations.phone` guarda
   * sempre o número do PEER visto pelo dono (ver `canonicalInternalPair`) — correto
   * quando quem envia é o dono, mas quando é o peer enviando, o destino tem que
   * ser o número do dono, não `conv.phone` (que é o número do próprio peer).
   */
  targetPhone: string;
} | null> {
  const [conv] = await db
    .select({
      channelId: whatsappConversations.channelId,
      peerChannelId: whatsappConversations.peerChannelId,
      phone: whatsappConversations.phone,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  if (!conv?.channelId) return null;

  if (conv.peerChannelId != null) {
    // Quem "assina" o envio: o canal escolhido explicitamente (supervisor pela
    // caixa de um lado) tem prioridade; senão infere pela participação do
    // usuário logado (peer sem ser dono → envia como peer).
    let sendAsPeer: boolean;
    if (actAsChannelId === conv.peerChannelId) {
      sendAsPeer = true;
    } else if (actAsChannelId === conv.channelId) {
      sendAsPeer = false;
    } else {
      const userChannelIds = await listChannelIdsForUser(requestingUserId);
      const isPeer = userChannelIds.includes(conv.peerChannelId);
      const isOwner = userChannelIds.includes(conv.channelId);
      sendAsPeer = isPeer && !isOwner;
    }
    if (sendAsPeer) {
      const [peerResolved, owner] = await Promise.all([
        resolveChannelById(conv.peerChannelId).catch(() => null),
        getChannelIdentityById(conv.channelId).catch(() => null),
      ]);
      if (peerResolved && owner?.displayPhone) {
        return { channel: peerResolved, channelId: conv.peerChannelId, direction: "inbound", targetPhone: owner.displayPhone };
      }
    }
  }

  const ownerResolved = await resolveChannelForConversation(conversationId).catch(() => null);
  if (!ownerResolved) return null;
  return { channel: ownerResolved, channelId: conv.channelId, direction: "outbound", targetPhone: conv.phone };
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

/**
 * Decide se uma resposta inbound deve rotear a conversa para o setor do
 * vendedor responsável pelo cliente. Só dispara na PRIMEIRA resposta a uma
 * conversa de origem de campanha — não em qualquer mensagem espontânea (ver
 * comentário sobre isClientAccessibleToUser acima) nem em respostas
 * subsequentes, para não sobrescrever uma transferência manual feita depois
 * por um atendente. Função pura para ser testável sem banco.
 */
export function resolveCampaignReplySectorTarget(input: {
  hasResponsibleSeller: boolean;
  hasCampaignOrigin: boolean;
  isFirstInboundReply: boolean;
  sellerSectorId: string | null;
}): string | null {
  if (!input.hasResponsibleSeller || !input.hasCampaignOrigin || !input.isFirstInboundReply) return null;
  return input.sellerSectorId;
}

/**
 * Se esta for a primeira resposta do contato a uma conversa que se originou
 * de uma campanha (whatsappMessages.campaignMessageId), transfere a conversa
 * para o setor ao qual o vendedor responsável pelo cliente pertence. Sem
 * setor configurado para o vendedor, mantém o setor padrão do canal (setado
 * na criação da conversa) — nunca bloqueia nem lança erro.
 */
async function routeCampaignReplyToSellerSector(conversationId: string, clientId: string | null, newMessageId: string) {
  const client = clientId
    ? (await db.select({ responsavelId: clients.responsavelId }).from(clients).where(eq(clients.id, clientId)).limit(1))[0]
    : null;

  const campaignOriginRow = (
    await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(and(eq(whatsappMessages.conversationId, conversationId), isNotNull(whatsappMessages.campaignMessageId)))
      .limit(1)
  )[0];

  const priorInbound = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.direction, "inbound"),
        ne(whatsappMessages.id, newMessageId),
      ),
    )
    .limit(1);

  let sellerSectorId: string | null = null;
  if (client?.responsavelId) {
    const membership = await db
      .select({ sectorId: whatsappSectorMembers.sectorId })
      .from(whatsappSectorMembers)
      .innerJoin(whatsappSectors, eq(whatsappSectors.id, whatsappSectorMembers.sectorId))
      .where(and(eq(whatsappSectorMembers.userId, client.responsavelId), eq(whatsappSectors.isActive, true)))
      .orderBy(asc(whatsappSectorMembers.createdAt))
      .limit(1);
    sellerSectorId = membership[0]?.sectorId ?? null;
  }

  const targetSectorId = resolveCampaignReplySectorTarget({
    hasResponsibleSeller: !!client?.responsavelId,
    hasCampaignOrigin: !!campaignOriginRow,
    isFirstInboundReply: priorInbound.length === 0,
    sellerSectorId,
  });

  if (targetSectorId) {
    await transferConversationToSector(
      conversationId,
      targetSectorId,
      "Resposta à campanha — roteado automaticamente para o setor do vendedor responsável",
    );
  }
}

export async function closeConversation(
  conversationId: string,
  userId: string,
  userRole: string,
  asChannelId?: number,
) {
  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const operational = await resolveOperationalPerspective(
    conversationId,
    userId,
    userRole,
    asChannelId,
  );
  if (!operational) return null;

  if (operational.perspectiveChannelId == null) {
    const [updated] = await db
      .update(whatsappConversations)
      .set({ status: "closed", updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversationId))
      .returning();
    if (!updated) return null;
  } else {
    await setPerspectiveStatus(
      conversationId,
      operational.perspectiveChannelId,
      "closed",
      userId,
    );
  }

  const perspectiveChannel =
    operational.perspectiveChannelId != null
      ? await getChannelIdentityById(operational.perspectiveChannelId).catch(() => null)
      : null;
  const perspectiveLabel = perspectiveChannel?.name
    ? ` na perspectiva ${perspectiveChannel.name}`
    : "";

  await db.insert(whatsappMessages).values({
    conversationId,
    direction: "outbound",
    type: "system",
    content: `🔒 Atendimento${perspectiveLabel} encerrado por ${user?.name ?? "atendente"}`,
    status: "sent",
    sentAt: new Date(),
    rawPayload: {
      kind: "conversation_closed",
      perspectiveChannelId: operational.perspectiveChannelId,
    },
  });

  return operational.conversation;
}

export async function reopenConversation(
  conversationId: string,
  userId: string,
  userRole: string,
  asChannelId?: number,
) {
  const operational = await resolveOperationalPerspective(
    conversationId,
    userId,
    userRole,
    asChannelId,
  );
  if (!operational) return null;

  if (operational.perspectiveChannelId == null) {
    const [updated] = await db
      .update(whatsappConversations)
      .set({ status: "open", updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversationId))
      .returning();
    if (!updated) return null;
  } else {
    await setPerspectiveStatus(conversationId, operational.perspectiveChannelId, "open");
  }
  return operational.conversation;
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
  // Canais do leitor — usado tanto na contagem de não-lidas relativa ao leitor
  // (unreadSub, abaixo) quanto no rótulo/direção do par interno no mapeamento
  // final. Calculado uma vez aqui em vez de sob demanda para poder alimentar a
  // CTE de não-lidas.
  const viewerChannelIds = await listChannelIdsForUser(userId).catch(() => []);

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
      .where(
        and(
          eq(whatsappConversationReads.userId, userId),
          // Só a marcação da conversa inteira. As marcações por lado (gravadas
          // pelo mesmo admin/gerente ao abrir uma caixa de diálogo interno
          // desdobrado, ver perspectiveUnread abaixo) não podem entrar aqui: o
          // join de unreadSub é só por conversationId, então cada linha extra
          // MULTIPLICARIA o count(*) — contando a mesma mensagem não-lida
          // várias vezes para o mesmo admin em toda conversa da lista.
          isNull(whatsappConversationReads.perspectiveChannelId),
        ),
      ),
  );

  // Uma mensagem é "recebida não-lida" quando, no referencial do leitor, é
  // inbound. Espelha `messageIsUnreadIncoming`/`directionForViewer`: para o
  // leitor do lado peer de um diálogo interno, a direção gravada (relativa ao
  // dono) é invertida — daí o CASE. Sem canais próprios o leitor nunca é peer,
  // então basta `direction = 'inbound'` (caminho das conversas externas).
  const unreadIncoming =
    viewerChannelIds.length === 0
      ? sql`${whatsappMessages.direction} = 'inbound'`
      : sql`CASE
              WHEN ${whatsappConversations.peerChannelId} IS NOT NULL
               AND ${inArray(whatsappConversations.peerChannelId, viewerChannelIds)}
               AND (${whatsappConversations.channelId} IS NULL
                    OR NOT (${inArray(whatsappConversations.channelId, viewerChannelIds)}))
              THEN ${whatsappMessages.direction} = 'outbound'
              ELSE ${whatsappMessages.direction} = 'inbound'
            END`;

  const unreadSub = db.$with("unread").as(
    db
      .select({
        conversationId: whatsappMessages.conversationId,
        unreadCount: sql<number>`cast(count(*) as int)`.as("unread_count"),
      })
      .from(whatsappMessages)
      // Join com a conversa para conhecer peerChannelId/channelId — necessário
      // para traduzir a direção ao referencial do leitor na condição acima.
      .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
      .leftJoin(readsSub, eq(whatsappMessages.conversationId, readsSub.conversationId))
      .where(
        and(
          unreadIncoming,
          ne(whatsappMessages.type, "system"),
          ne(whatsappMessages.type, "note"),
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
  const isSupervisor = userRole === "admin" || userRole === "gerente";

  const conditions: ReturnType<typeof eq>[] = [];
  const ownerPerspectiveStatus = sql<"open" | "closed">`COALESCE(
    (
      SELECT perspective_state.status
      FROM ${whatsappConversationPerspectiveStates} perspective_state
      WHERE perspective_state.conversation_id = ${whatsappConversations.id}
        AND perspective_state.channel_id = ${whatsappConversations.channelId}
      LIMIT 1
    ),
    CASE WHEN ${whatsappConversations.status} = 'closed' THEN 'closed' ELSE 'open' END
  )`;
  const peerPerspectiveStatus = sql<"open" | "closed">`COALESCE(
    (
      SELECT perspective_state.status
      FROM ${whatsappConversationPerspectiveStates} perspective_state
      WHERE perspective_state.conversation_id = ${whatsappConversations.id}
        AND perspective_state.channel_id = ${whatsappConversations.peerChannelId}
      LIMIT 1
    ),
    CASE WHEN ${whatsappConversations.status} = 'closed' THEN 'closed' ELSE 'open' END
  )`;

  if (status) {
    const externalStatus =
      status === "closed"
        ? eq(whatsappConversations.status, "closed")
        : ne(whatsappConversations.status, "closed");
    const internalStatus = isSupervisor
      ? or(
          sql`${ownerPerspectiveStatus} = ${status}`,
          sql`${peerPerspectiveStatus} = ${status}`,
        )
      : viewerChannelIds.length > 0
        ? sql`(
            CASE
              WHEN ${inArray(whatsappConversations.peerChannelId, viewerChannelIds)}
               AND NOT (${inArray(whatsappConversations.channelId, viewerChannelIds)})
              THEN ${peerPerspectiveStatus}
              ELSE ${ownerPerspectiveStatus}
            END
          ) = ${status}`
        : sql`${ownerPerspectiveStatus} = ${status}`;
    conditions.push(
      or(
        and(isNull(whatsappConversations.peerChannelId), externalStatus),
        and(isNotNull(whatsappConversations.peerChannelId), internalStatus),
      ) as unknown as ReturnType<typeof eq>,
    );
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
          conversationAddressedToOwnChannelInSectors(realSectorIds),
        ) as unknown as ReturnType<typeof eq>,
      );
    } else if (realSectorIds.length > 0) {
      conditions.push(
        or(
          inArray(whatsappConversations.sectorId, realSectorIds),
          conversationAddressedToOwnChannelInSectors(realSectorIds),
        ) as unknown as ReturnType<typeof eq>,
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
      or(
        inArray(whatsappConversations.channelId, filters.channelIds),
        conversationAddressedToOwnChannel(filters.channelIds),
      ) as unknown as ReturnType<typeof eq>,
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
  const peerChannels = alias(whatsappChannels, "peer_channels");
  // Nome do atendente dono de cada canal (whatsapp_channels.userId → users.name)
  // — usado no rótulo de diálogo interno em vez do nome do canal (ver
  // internalPeerLabel). Canal sem dono (compartilhado) deixa esses campos null
  // e o rótulo cai para o nome do canal.
  const ownerChannelUsers = alias(users, "owner_channel_users");
  const peerChannelUsers = alias(users, "peer_channel_users");

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
      channelUserName: ownerChannelUsers.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
      channelConnectionStatus: whatsappChannels.connectionStatus,
      channelProvider: whatsappChannels.provider,
      sectorId: whatsappConversations.sectorId,
      sectorName: whatsappSectors.name,
      sectorColor: whatsappSectors.color,
      status: whatsappConversations.status,
      ownerPerspectiveStatus: ownerPerspectiveStatus.as("owner_perspective_status"),
      peerPerspectiveStatus: peerPerspectiveStatus.as("peer_perspective_status"),
      responsavelId: clients.responsavelId,
      responsavelName: responsavelUsers.name,
      whatsappOptOut: clients.whatsappOptOut,
      peerChannelId: whatsappConversations.peerChannelId,
      peerChannelName: peerChannels.name,
      peerChannelUserName: peerChannelUsers.name,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .leftJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .leftJoin(peerChannels, eq(whatsappConversations.peerChannelId, peerChannels.id))
    .leftJoin(ownerChannelUsers, eq(whatsappChannels.userId, ownerChannelUsers.id))
    .leftJoin(peerChannelUsers, eq(peerChannels.userId, peerChannelUsers.id))
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

  // Diálogo interno para admin/gerente vira DUAS entradas na lista — a "caixa"
  // de cada lado do par (ver expansão no return). Cada lado tem sua própria
  // contagem de não-lidas, relativa ao SUPERVISOR LOGADO (não ao atendente
  // dono do canal): a badge de cada caixa reflete o que o admin ainda não leu
  // NAQUELE lado — a marcação é o perspectiveChannelId gravado por
  // markConversationRead ao clicar naquela caixa (ver
  // whatsapp_conversation_reads em shared/schema.ts). Calculado só para os
  // diálogos internos da página e só quando o leitor é supervisor.
  const internalIds = isSupervisor
    ? pageRows.filter((r) => r.peerChannelId != null && r.channelId != null).map((r) => r.conversationId)
    : [];
  const perspectiveUnread = new Map<string, { owner: number; peer: number }>();
  if (internalIds.length > 0) {
    // Não-lida por lado = mensagens que, no referencial daquele lado, são
    // recebidas (dono: direction 'inbound'; peer: 'outbound', pois direction é
    // gravada relativa ao dono) e chegaram após o last_read DO SUPERVISOR para
    // aquele lado especificamente (perspectiveChannelId = channelId do lado).
    // Duas agregações simples em vez de uma com FILTER, para manter o padrão
    // do query builder e ler o read certo em cada join.
    //
    // Chave do join é channelId/peerChannelId da CONVERSA, não mais o userId
    // do canal (whatsappChannels.userId): channelId nunca é null aqui —
    // internalIds já exige isso — enquanto whatsappChannels.userId é
    // nullable, e um canal sem dono fazia o left join não casar, o lastReadAt
    // cair em null e COALESCE tratar todo o histórico como não-lido para
    // sempre. Trocar a chave elimina esse caso por construção.
    const ownerReads = alias(whatsappConversationReads, "owner_side_reads");
    const peerReads = alias(whatsappConversationReads, "peer_side_reads");

    const [ownerUnreadRows, peerUnreadRows] = await Promise.all([
      db
        .select({
          conversationId: whatsappMessages.conversationId,
          cnt: sql<number>`cast(count(*) as int)`,
        })
        .from(whatsappMessages)
        .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
        .leftJoin(
          ownerReads,
          and(
            eq(ownerReads.conversationId, whatsappConversations.id),
            eq(ownerReads.userId, userId),
            eq(ownerReads.perspectiveChannelId, whatsappConversations.channelId),
          ),
        )
        .where(
          and(
            inArray(whatsappMessages.conversationId, internalIds),
            eq(whatsappMessages.direction, "inbound"),
            ne(whatsappMessages.type, "system"),
            ne(whatsappMessages.type, "note"),
            sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt}) > COALESCE(${ownerReads.lastReadAt}, '1970-01-01'::timestamp)`,
          ),
        )
        .groupBy(whatsappMessages.conversationId),
      db
        .select({
          conversationId: whatsappMessages.conversationId,
          cnt: sql<number>`cast(count(*) as int)`,
        })
        .from(whatsappMessages)
        .innerJoin(whatsappConversations, eq(whatsappMessages.conversationId, whatsappConversations.id))
        .leftJoin(
          peerReads,
          and(
            eq(peerReads.conversationId, whatsappConversations.id),
            eq(peerReads.userId, userId),
            eq(peerReads.perspectiveChannelId, whatsappConversations.peerChannelId),
          ),
        )
        .where(
          and(
            inArray(whatsappMessages.conversationId, internalIds),
            eq(whatsappMessages.direction, "outbound"),
            ne(whatsappMessages.type, "system"),
            ne(whatsappMessages.type, "note"),
            sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt}) > COALESCE(${peerReads.lastReadAt}, '1970-01-01'::timestamp)`,
          ),
        )
        .groupBy(whatsappMessages.conversationId),
    ]);

    for (const r of ownerUnreadRows) {
      const cur = perspectiveUnread.get(r.conversationId) ?? { owner: 0, peer: 0 };
      cur.owner = r.cnt;
      perspectiveUnread.set(r.conversationId, cur);
    }
    for (const r of peerUnreadRows) {
      const cur = perspectiveUnread.get(r.conversationId) ?? { owner: 0, peer: 0 };
      cur.peer = r.cnt;
      perspectiveUnread.set(r.conversationId, cur);
    }
  }

  // Rótulo do diálogo interno é resolvido por quem está lendo (ver
  // internalPeerLabel) — não pode ser gravado em contact_name, senão o
  // atendente do canal peer leria o nome do próprio canal como se fosse o
  // contato. `viewerChannelIds` já foi calculado no topo (também alimenta a
  // contagem de não-lidas relativa ao leitor).
  return {
    items: pageRows.flatMap((row) => {
      const base = {
        ...row,
        perspectiveChannelId: null as number | null,
        tags: row.clientId ? (tagsByClient.get(row.clientId) ?? []) : [],
        whatsappTags: row.clientId ? (whatsappTagsByClient.get(row.clientId) ?? []) : [],
      };

      // Diálogo interno + supervisor: uma entrada por lado do par. Cada uma abre
      // a conversa fixada naquela perspectiva (perspectiveChannelId), e o
      // frontend usa esse id como identidade do item e como asChannelId.
      if (isSupervisor && row.peerChannelId != null && row.channelId != null) {
        const un = perspectiveUnread.get(row.conversationId) ?? { owner: 0, peer: 0 };
        const makeItem = (
          perspectiveChannelId: number,
          unreadCount: number,
          perspectiveStatus: "open" | "closed",
        ) => {
          const viewerIsPeer = viewerIsPeerSide(row, [perspectiveChannelId]);
          return {
            ...base,
            perspectiveChannelId,
            contactName: internalPeerLabel(row, [perspectiveChannelId]) ?? row.contactName,
            lastMessageDirection: row.lastMessageDirection
              ? directionForViewer(row.lastMessageDirection, viewerIsPeer)
              : row.lastMessageDirection,
            unreadCount,
            status: perspectiveStatus,
          };
        };
        return [
          makeItem(row.channelId, un.owner, row.ownerPerspectiveStatus),
          makeItem(row.peerChannelId, un.peer, row.peerPerspectiveStatus),
        ].filter((item) => !status || item.status === status);
      }

      // Demais casos: um item, perspectiva derivada do leitor logado (como hoje).
      const viewerIsPeer = viewerIsPeerSide(row, viewerChannelIds);
      return [
        {
          ...base,
          status:
            row.peerChannelId == null
              ? row.status
              : viewerIsPeer
                ? row.peerPerspectiveStatus
                : row.ownerPerspectiveStatus,
          contactName: internalPeerLabel(row, viewerChannelIds) ?? row.contactName,
          lastMessageDirection: row.lastMessageDirection
            ? directionForViewer(row.lastMessageDirection, viewerIsPeer)
            : row.lastMessageDirection,
        },
      ];
    }),
    nextCursor,
  };
}

export async function getConversation(
  conversationId: string,
  userId: string,
  userRole: string,
  pagination: { cursor?: Cursor | null; limit?: number } = {},
  opts: { asChannelId?: number } = {},
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

  const peerChannels = alias(whatsappChannels, "peer_channels");
  const ownerChannels = alias(whatsappChannels, "owner_channels");
  const ownerChannelUsers = alias(users, "owner_channel_users");
  const peerChannelUsers = alias(users, "peer_channel_users");
  const lastInboundAt = sql<Date | null>`(
    SELECT MAX(COALESCE(inbound_message.sent_at, inbound_message.created_at))
    FROM whatsapp_messages inbound_message
    WHERE inbound_message.conversation_id = ${whatsappConversations.id}
      AND inbound_message.direction = 'inbound'
      AND inbound_message.type NOT IN ('system', 'note')
  )`.mapWith(whatsappMessages.sentAt);

  const [convRow] = await db
    .select({
      id: whatsappConversations.id,
      clientId: whatsappConversations.clientId,
      phone: whatsappConversations.phone,
      contactName: whatsappConversations.contactName,
      contactPhotoUrl: whatsappConversations.contactPhotoUrl,
      lastInboundAt,
      channelId: whatsappConversations.channelId,
      channelName: ownerChannels.name,
      channelUserName: ownerChannelUsers.name,
      peerChannelId: whatsappConversations.peerChannelId,
      peerChannelName: peerChannels.name,
      peerChannelUserName: peerChannelUsers.name,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .leftJoin(ownerChannels, eq(whatsappConversations.channelId, ownerChannels.id))
    .leftJoin(ownerChannelUsers, eq(ownerChannels.userId, ownerChannelUsers.id))
    .leftJoin(peerChannels, eq(whatsappConversations.peerChannelId, peerChannels.id))
    .leftJoin(peerChannelUsers, eq(peerChannels.userId, peerChannelUsers.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!convRow) return null;

  // Mesmo rótulo relativo ao leitor usado na listagem (ver internalPeerLabel).
  // Admin/gerente podem "espiar" um diálogo interno pela perspectiva do outro
  // lado do par (ex.: thiago vendo como o eventos vê). O override troca de qual
  // canal se considera o leitor — toda a lógica de perspectiva (rótulo, direção,
  // viewerIsPeer) já deriva de viewerChannelIds, então nada mais precisa mudar.
  // Só vale para conversa interna e quando asChannelId é um dos dois lados do par.
  const perspectiveOverride = resolvePerspectiveOverride(userRole, convRow, opts.asChannelId);
  const viewerChannelIds =
    perspectiveOverride != null
      ? [perspectiveOverride]
      : convRow.peerChannelId != null
        ? await listChannelIdsForUser(userId)
        : [];
  const viewerIsPeer = viewerIsPeerSide(convRow, viewerChannelIds);
  const conv = {
    ...convRow,
    contactName: internalPeerLabel(convRow, viewerChannelIds) ?? convRow.contactName,
  };

  const replyMsg = alias(whatsappMessages, "reply_msg");
  const messageChannelUsers = alias(users, "message_channel_users");
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
      statusReason: whatsappMessages.statusReason,
      deliveredAt: whatsappMessages.deliveredAt,
      readAt: whatsappMessages.readAt,
      replyToMessageId: whatsappMessages.replyToMessageId,
      replyToContentSnapshot: whatsappMessages.replyToContentSnapshot,
      replyToTypeSnapshot: whatsappMessages.replyToTypeSnapshot,
      replyToDirectionSnapshot: whatsappMessages.replyToDirectionSnapshot,
      origin: whatsappMessages.origin,
      isForwarded: whatsappMessages.isForwarded,
      forwardedFromMessageId: whatsappMessages.forwardedFromMessageId,
      forwardedFromConversationId: whatsappMessages.forwardedFromConversationId,
      providerMetadata: whatsappMessages.providerMetadata,
      sentByUserId: whatsappMessages.sentByUserId,
      campaignMessageId: whatsappMessages.campaignMessageId,
      sentAt: whatsappMessages.sentAt,
      createdAt: whatsappMessages.createdAt,
      replyToContent: replyMsg.content,
      replyToType: replyMsg.type,
      replyToDirection: replyMsg.direction,
      channelId: whatsappMessages.channelId,
      channelName: whatsappChannels.name,
      // Nome do atendente dono do canal por onde ESTA mensagem saiu — usado no
      // badge por mensagem em vez do nome do canal (mesma ideia da Fase 9,
      // mas por mensagem: numa conversa unificada, cada mensagem pode ter
      // saído por um canal/atendente diferente).
      channelUserName: messageChannelUsers.name,
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
    .leftJoin(messageChannelUsers, eq(whatsappChannels.userId, messageChannelUsers.id))
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

  const messages = pageRows.map((m) => {
    const {
      replyToContentSnapshot,
      replyToTypeSnapshot,
      replyToDirectionSnapshot,
      ...message
    } = m;
    const replyDirection = m.replyToDirection ?? replyToDirectionSnapshot;
    return {
      ...message,
      replyToContent: m.replyToContent ?? replyToContentSnapshot,
      replyToType: m.replyToType ?? replyToTypeSnapshot,
      direction: directionForViewer(m.direction as "inbound" | "outbound", viewerIsPeer),
      replyToDirection: replyDirection
        ? directionForViewer(replyDirection as "inbound" | "outbound", viewerIsPeer)
        : null,
      reactions: (reactionsByMessage.get(m.id) ?? []).map((r) => ({
        ...r,
        direction: directionForViewer(r.direction, viewerIsPeer),
      })),
    };
  });

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

  // Canal de envio: o dono da conversa, exceto em diálogo interno canal↔canal
  // em que quem está enviando é o atendente do lado peer — aí sai pelo canal
  // dele, não pelo dono (ver resolveOutboundChannelForSender). Admin/gerente
  // podem "assinar" pelo canal escolhido (channelId) — responder pela caixa de
  // um lado de um diálogo interno; para os demais o override é ignorado.
  const actAsChannelId =
    userRole === "admin" || userRole === "gerente" ? channelId : undefined;
  const resolved = await resolveOutboundChannelForSender(conversationId, userId, actAsChannelId);

  // Sem canal resolvível, NÃO envia: cair no default global (wa_phone_number_id)
  // faria a mensagem sair por um número diferente do da conversa (ex.: Dionisio),
  // e a resposta do contato cairia na conversa errada.
  if (!resolved) {
    throw new Error(
      "Conversa sem canal de envio configurado — não é possível enviar. Verifique o canal vinculado à conversa.",
    );
  }
  const resolvedChannel = resolved.channel;

  // Persiste a mensagem imediatamente como "failed" — atualiza para "sent" se a API responder ok
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      channelId: resolved.channelId,
      direction: resolved.direction,
      type: "text",
      content: message,
      origin: "crm",
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
        resolved.targetPhone,
        message,
        {
          quotedMsgId: replyToWaMessageId ?? undefined,
          idempotencyKey: `message-${savedMessage.id}`,
        },
      );
      waMessageId = evoResult?.key?.id ?? null;
    } else {
      const cloudOverride = resolvedChannel?.provider === "cloud_api"
        ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
        : null;
      const result = await sendTextMessage(resolved.targetPhone, message, cloudOverride ?? undefined, replyToWaMessageId ?? undefined);
      waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
    }

    // O webhook/eco pode gravar delivered ou read antes deste ACK. Confirmação
    // de envio nunca pode regredir um estado mais avançado para "sent".
    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId })
      .where(
        and(
          eq(whatsappMessages.id, savedMessage.id),
          inArray(whatsappMessages.status, SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES),
          isNull(whatsappMessages.statusReason),
        ),
      );
    await reopenActivePerspective(conversationId, resolved.channelId);

    // Publica o evento SSE depois da confirmação, para que a UI veja o estado
    // persistido — "sent" ou um estado mais avançado já recebido pelo webhook.
    if (conv.id) {
      publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return { waMessageId, messageId: savedMessage.id };
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

  const actAsChannelId =
    userRole === "admin" || userRole === "gerente" ? channelId : undefined;
  const resolved = await resolveOutboundChannelForSender(conversationId, userId, actAsChannelId);

  // Templates oficiais só existem no canal cloud_api (API da Meta).
  if (resolved?.channel.provider !== "cloud_api") {
    throw new Error(
      "Templates só podem ser enviados pelo canal oficial do WhatsApp (Cloud API).",
    );
  }
  const resolvedChannel = resolved.channel;

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
      channelId: resolved.channelId,
      direction: resolved.direction,
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

    console.log(`[sendConversationTemplate] template="${templateName}" lang="${languageCode}" parameterFormat="${parameterFormat ?? "não informado"}" phone="${resolved.targetPhone}"`);
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
      resolved.targetPhone,
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
      .where(
        and(
          eq(whatsappMessages.id, savedMessage.id),
          inArray(whatsappMessages.status, SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES),
          isNull(whatsappMessages.statusReason),
        ),
      )
      .returning({ id: whatsappMessages.id, status: whatsappMessages.status });

    console.log(`[sendConversationTemplate] DB update result:`, JSON.stringify(updateResult));
    await reopenActivePerspective(conversationId, resolved.channelId);

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

  const actAsChannelId =
    userRole === "admin" || userRole === "gerente" ? channelId : undefined;
  const resolved = await resolveOutboundChannelForSender(conversationId, userId, actAsChannelId);

  // Sem canal resolvível, NÃO envia (mesma razão de sendConversationMessage):
  // evita cair no número global e mandar a mídia pelo número errado.
  if (!resolved) {
    throw new Error(
      "Conversa sem canal de envio configurado — não é possível enviar. Verifique o canal vinculado à conversa.",
    );
  }
  const resolvedChannel = resolved.channel;

  console.log(`[sendConversationMedia] provider=${resolvedChannel.provider}`);

  let waMessageId: string | null = null;
  let waMediaId: string | null = null;
  let storageKey: string | null = null;
  const [savedMessage] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      channelId: resolved.channelId,
      direction: resolved.direction,
      type: mediaType,
      content: null,
      origin: "crm",
      caption: caption ?? null,
      status: "failed",
      sentByUserId: userId,
      sentAt: new Date(),
      replyToMessageId: replyToMessageId ?? null,
    })
    .returning({ id: whatsappMessages.id });

  if (resolvedChannel?.provider === "evolution") {
    const evoMediaType = mediaType;
    console.log(`[sendConversationMedia] Evolution sendMedia type=${evoMediaType}`);
    try {
      storageKey = await uploadWhatsappMedia(effectiveBuffer, effectiveMime);
      const evoResult = await evoSendMedia(
        resolvedChannel.evolutionInstanceName,
        resolved.targetPhone,
        evoMediaType,
        {
          url: getPublicR2Url(storageKey),
          caption,
          filename: effectiveName,
          mimetype: effectiveMime,
          quotedMsgId: replyToWaMessageId ?? undefined,
          idempotencyKey: `message-${savedMessage.id}`,
        },
      );
      waMessageId = evoResult?.key?.id ?? null;
    } catch (err) {
      console.error(`[sendConversationMedia] Evolution sendMedia falhou:`, err);
      // O objeto sobe antes do envio (o gateway lê a mídia do R2). Se o envio
      // falha, nenhuma linha de whatsapp_media vai referenciá-lo — sem esta
      // limpeza o bucket acumula um órfão por tentativa frustrada.
      const orphanKey = storageKey;
      if (orphanKey) {
        storageKey = null;
        await deleteR2Object(orphanKey).catch((cleanupErr) =>
          console.error(
            `[sendConversationMedia] falha ao remover mídia órfã ${orphanKey}:`,
            cleanupErr,
          ),
        );
      }
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
      const result = await sendMediaMessage(resolved.targetPhone, waMediaId, mediaType, caption ?? undefined, undefined, cloudOverride ?? undefined, replyToWaMessageId ?? undefined);
      waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
    } catch (err) {
      console.error(`[sendConversationMedia] sendMediaMessage falhou:`, err);
      throw err;
    }
  }

  await db
    .update(whatsappMessages)
    .set({ status: "sent", waMessageId })
    .where(
      and(
        eq(whatsappMessages.id, savedMessage.id),
        inArray(whatsappMessages.status, SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES),
        isNull(whatsappMessages.statusReason),
      ),
    );

  // No QR/Baileys o upload ocorre antes do envio, pois o gateway baixa a mídia
  // diretamente do R2. Na Cloud API a cópia posterior continua não bloqueante.
  if (!storageKey) {
    try {
      storageKey = await uploadWhatsappMedia(effectiveBuffer, effectiveMime);
    } catch (err) {
      console.error(`[sendConversationMedia] falha ao cachear mídia no R2:`, err);
    }
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
  await reopenActivePerspective(conversationId, resolved.channelId);

  if (conv.id) {
    publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
  }

  return { id: savedMessage.id, status: "sent" };
}

export async function forwardConversationMessage(
  sourceConversationId: string,
  sourceMessageId: string,
  targetConversationIds: string[],
  userId: string,
  userRole: string,
): Promise<Array<{ conversationId: string; ok: boolean; message?: string }>> {
  if (!(await isConversationAccessibleToUser(sourceConversationId, userId, userRole))) {
    throw new Error("SOURCE_NOT_ACCESSIBLE");
  }
  const [source] = await db
    .select({
      id: whatsappMessages.id,
      type: whatsappMessages.type,
      content: whatsappMessages.content,
      caption: whatsappMessages.caption,
      storageKey: whatsappMedia.storageKey,
      mimeType: whatsappMedia.mimeType,
      filename: whatsappMedia.filename,
    })
    .from(whatsappMessages)
    .leftJoin(whatsappMedia, eq(whatsappMessages.id, whatsappMedia.messageId))
    .where(and(
      eq(whatsappMessages.id, sourceMessageId),
      eq(whatsappMessages.conversationId, sourceConversationId),
    ))
    .limit(1);
  if (!source) throw new Error("MESSAGE_NOT_FOUND");

  let file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined;
  if (source.type !== "text") {
    if (!source.storageKey || !source.mimeType) throw new Error("MEDIA_NOT_AVAILABLE");
    const object = await getWhatsappMediaObject(source.storageKey);
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) throw new Error("MEDIA_NOT_AVAILABLE");
    const buffer = Buffer.from(bytes);
    file = {
      buffer,
      originalname: source.filename ?? `whatsapp-${source.id}`,
      mimetype: source.mimeType,
      size: buffer.length,
    };
  }

  const results: Array<{ conversationId: string; ok: boolean; message?: string }> = [];
  for (const targetConversationId of Array.from(new Set(targetConversationIds))) {
    try {
      if (!(await isConversationAccessibleToUser(targetConversationId, userId, userRole))) {
        throw new Error("TARGET_NOT_ACCESSIBLE");
      }
      const sent = file
        ? await sendConversationMedia(
            targetConversationId, file, userId, userRole, undefined, source.caption ?? undefined,
          )
        : await sendConversationMessage(
            targetConversationId, source.content ?? "", userId, userRole,
          );
      const forwardedId = sent && "messageId" in sent ? sent.messageId : sent?.id;
      if (!forwardedId) throw new Error("SEND_FAILED");
      await db.update(whatsappMessages).set({
        isForwarded: true,
        forwardedFromMessageId: source.id,
        forwardedFromConversationId: sourceConversationId,
      }).where(eq(whatsappMessages.id, forwardedId));
      publishConversationEvent(targetConversationId, "new_message", {});
      results.push({ conversationId: targetConversationId, ok: true });
    } catch (error) {
      results.push({
        conversationId: targetConversationId,
        ok: false,
        message: error instanceof Error ? error.message : "SEND_FAILED",
      });
    }
  }
  return results;
}

export async function getConversationCapabilities(
  conversationId: string,
  userId: string,
  userRole: string,
): Promise<{
  reply: boolean;
  reaction: boolean;
  sticker: boolean;
  forward: boolean;
  deviceEcho: boolean;
  provider: "cloud_api" | "evolution";
} | null> {
  if (!(await isConversationAccessibleToUser(conversationId, userId, userRole))) return null;
  const resolved = await resolveOutboundChannelForSender(conversationId, userId);
  if (!resolved) return null;
  const provider = resolved.channel.provider === "evolution" ? "evolution" : "cloud_api";
  const [channelConfig] = await db
    .select({ deviceEchoEnabled: whatsappChannels.deviceEchoEnabled })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, resolved.channelId))
    .limit(1);
  return {
    reply: true,
    reaction: true,
    sticker: true,
    forward: true,
    deviceEcho: provider === "evolution" || channelConfig?.deviceEchoEnabled === true,
    provider,
  };
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
      // channelId/direction alimentam retryActAsChannelId — o reenvio tem que
      // sair pelo lado que originalmente tentou enviar.
      channelId: whatsappMessages.channelId,
      direction: whatsappMessages.direction,
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
    .select({
      id: whatsappConversations.id,
      phone: whatsappConversations.phone,
      clientId: whatsappConversations.clientId,
      channelId: whatsappConversations.channelId,
      peerChannelId: whatsappConversations.peerChannelId,
    })
    .from(whatsappConversations)
    .leftJoin(clients, eq(whatsappConversations.clientId, clients.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!conv) {
    console.warn(`[retryFailedMessage] conversa ${conversationId} não encontrada`);
    return null;
  }

  // Reenvia SEMPRE pelo lado que originalmente tentou enviar (ver
  // retryActAsChannelId) — não pelo lado de quem clicou em reenviar. Num
  // diálogo interno isso decide tanto o canal quanto o DESTINO: mandar para
  // conv.phone estando no lado peer seria mandar para o próprio número.
  // Sem canal resolvível, NÃO reenvia — cair no número global mandaria pelo
  // número errado.
  const resolved = await resolveOutboundChannelForSender(
    conversationId,
    userId,
    retryActAsChannelId(msg, conv),
  );
  if (!resolved) {
    throw new Error(
      "Conversa sem canal de envio configurado — não é possível reenviar. Verifique o canal vinculado à conversa.",
    );
  }
  const resolvedChannel = resolved.channel;
  const cloudOverride = resolvedChannel.provider === "cloud_api"
    ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
    : undefined;
  console.log(`[retryFailedMessage] to=${resolved.targetPhone} channelId=${resolved.channelId} provider=${resolvedChannel.provider}`);

  try {
    let result: unknown;

    // Mensagem de template do bot: re-envia o MESMO template (nome, idioma e
    // componentes interpolados gravados em rawPayload) em vez de mandar o texto
    // placeholder "Template: X" literalmente. Templates só existem no cloud_api.
    const payload = msg.rawPayload as
      | { kind?: string; templateName?: string; language?: string; components?: object[] }
      | null;
    if (
      msg.type === "template" &&
      payload?.templateName &&
      (payload.kind === "bot_template" || payload.kind === "conversation_template")
    ) {
      if (resolvedChannel.provider !== "cloud_api") {
        throw new Error("Templates só podem ser reenviados pelo canal oficial (Cloud API).");
      }
      console.log(`[retryFailedMessage] replay template="${payload.templateName}"`);
      const tplResult = await sendTemplateMessage(
        resolved.targetPhone,
        payload.templateName,
        payload.language ?? "pt_BR",
        payload.components ?? [],
        cloudOverride,
      );
      const tplWaId = ((tplResult as { messages?: Array<{ id?: string }> })?.messages)?.[0]?.id ?? null;
      // channelId grava o snapshot do canal de origem em linhas antigas que
      // ainda não o tinham. `direction` NÃO é tocada: continua relativa ao
      // dono, que é o que directionForViewer espera.
      await db
        .update(whatsappMessages)
        .set({ status: "sent", waMessageId: tplWaId, sentAt: new Date(), channelId: resolved.channelId })
        .where(
          and(
            eq(whatsappMessages.id, messageId),
            inArray(whatsappMessages.status, SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES),
            isNull(whatsappMessages.statusReason),
          ),
        );
      if (conv.id) {
        publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
      }
      return "sent";
    }

    const isMedia = msg.type === "image" || msg.type === "document" || msg.type === "video" || msg.type === "audio";

    console.log(`[retryFailedMessage] isMedia=${isMedia} waMediaId=${msg.waMediaId}`);

    if (isMedia) {
      // Reenvio de mídia por canal evolution exigiria o buffer original (o
      // waMediaId é um handle da Meta, sem equivalente no Baileys). Em vez de
      // cair no número global, orienta a reenviar o arquivo.
      if (resolvedChannel.provider !== "cloud_api") {
        throw new Error("Reenvio automático de mídia não é suportado neste canal. Envie o arquivo novamente.");
      }
      if (!msg.waMediaId) {
        console.error(`[retryFailedMessage] mensagem de mídia sem waMediaId — não é possível reenviar automaticamente`);
        throw new Error("Não foi possível reenviar: ID de mídia do WhatsApp ausente. Envie o arquivo novamente.");
      }
      const mediaTypeMap: Record<string, "image" | "document" | "video" | "audio"> = {
        image: "image", document: "document", video: "video", audio: "audio",
      };
      const mediaType = mediaTypeMap[msg.type!] ?? "document";
      console.log(`[retryFailedMessage] sendMediaMessage type=${mediaType} waMediaId=${msg.waMediaId}`);
      result = await sendMediaMessage(
        resolved.targetPhone,
        msg.waMediaId,
        mediaType,
        msg.caption ?? undefined,
        msg.filename ?? undefined,
        cloudOverride,
      );
    } else {
      if (!msg.content) throw new Error("Conteúdo da mensagem ausente para reenvio");
      console.log(`[retryFailedMessage] reenvio texto content="${msg.content}"`);
      if (resolvedChannel.provider === "evolution") {
        const evoResult = await evoSendText(
          resolvedChannel.evolutionInstanceName,
          resolved.targetPhone,
          msg.content,
          { idempotencyKey: `message-${messageId}` },
        );
        result = { messages: [{ id: evoResult?.key?.id ?? null }] };
      } else {
        result = await sendTextMessage(resolved.targetPhone, msg.content, cloudOverride);
      }
    }

    console.log(`[retryFailedMessage] envio OK:`, JSON.stringify(result));
    const waMessageId = ((result as { messages?: Array<{ id?: string }> })?.messages)?.[0]?.id ?? null;

    // channelId: ver comentário no ramo de template acima.
    await db
      .update(whatsappMessages)
      .set({ status: "sent", waMessageId, sentAt: new Date(), channelId: resolved.channelId })
      .where(
        and(
          eq(whatsappMessages.id, messageId),
          inArray(whatsappMessages.status, SENT_CONFIRMATION_ALLOWED_CURRENT_STATUSES),
          isNull(whatsappMessages.statusReason),
        ),
      );

    if (conv.id) {
      publishConversationEvent(conv.id, "new_message", { clientId: conv.clientId ?? null });
    }

    return "sent";
  } catch (err) {
    console.error(`[retryFailedMessage] FALHOU messageId=${messageId}:`, err);
    throw err;
  }
}

/**
 * Direção da mensagem RELATIVA AO CANAL DONO da conversa. Num diálogo interno
 * canal↔canal a mesma conversa é alimentada pelas duas instâncias Baileys: o
 * que é `fromMe` para a instância do peer é `inbound` para a conversa. Por isso
 * a direção sai da comparação entre o remetente real e o número do canal dono,
 * e não do flag `_fromMe` do evento. Sem `senderPhone` (chamadores antigos),
 * cai no comportamento anterior.
 */
async function resolveMessageDirection(
  conv: { channelId: number | null; peerChannelId: number | null },
  data: { senderPhone?: string; direction?: "inbound" | "outbound"; _fromMe?: boolean },
): Promise<"inbound" | "outbound"> {
  const fallback = data.direction ?? (data._fromMe ? "outbound" : "inbound");
  if (!data.senderPhone || conv.channelId == null) return fallback;

  const owner = await getChannelIdentityById(conv.channelId).catch(() => null);
  if (!owner?.displayPhone) return fallback;

  return isSameChannelPhone(owner.displayPhone, data.senderPhone) ? "outbound" : "inbound";
}

/** Janela em que um eco do WhatsApp ainda pode se referir a uma mensagem que o
 * CRM acabou de enviar e cujo waMessageId ainda não foi gravado. */
const ECHO_BACKFILL_WINDOW_MS = 60_000;

/**
 * Casa um eco `fromMe` com a mensagem que o CRM já gravou para o mesmo envio,
 * gravando nela o `waMessageId` que faltava. Retorna true quando o eco foi
 * absorvido (o chamador não deve inserir nada).
 *
 * O critério de "foi o CRM que gravou" é `sentByUserId IS NOT NULL` — não
 * `direction = "outbound"`. Numa conversa interna, o envio do atendente do
 * lado PEER grava `direction: "inbound"` (relativo ao dono, ver
 * `resolveOutboundChannelForSender`); se este filtro exigisse "outbound", o
 * eco do envio do peer nunca casaria com a linha do CRM e viraria uma segunda
 * mensagem real no banco.
 */
export async function backfillEchoedOutboundMessage(
  conversationId: string,
  data: { waMessageId: string; type: string; content: string | null },
): Promise<boolean> {
  const since = new Date(Date.now() - ECHO_BACKFILL_WINDOW_MS);

  const [pending] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.type, data.type),
        isNull(whatsappMessages.waMessageId),
        isNotNull(whatsappMessages.sentByUserId),
        gte(whatsappMessages.createdAt, since),
        data.content === null
          ? isNull(whatsappMessages.content)
          : eq(whatsappMessages.content, data.content),
      ),
    )
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);

  if (!pending) return false;

  await db
    .update(whatsappMessages)
    .set({ waMessageId: data.waMessageId })
    .where(and(eq(whatsappMessages.id, pending.id), isNull(whatsappMessages.waMessageId)));

  console.log(
    `[WA Webhook] Eco de mensagem enviada pelo CRM absorvido na mensagem ${pending.id} (${data.waMessageId}).`,
  );
  return true;
}

export interface SaveInboundMessageResult {
  saved: boolean;
  conversationId: string | null;
  direction: "inbound" | "outbound" | null;
  channelId: number | null;
  startsConversation: boolean;
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
  replyToContentSnapshot?: string | null;
  replyToTypeSnapshot?: string;
  replyToDirectionSnapshot?: "inbound" | "outbound";
  isForwarded?: boolean;
  providerMetadata?: Record<string, unknown>;
  /** Permite sobrescrever a direção da mensagem (padrão: "inbound"). Usado pelo Evolution para fromMe:true. */
  direction?: "inbound" | "outbound";
  /** @internal usado pelo Evolution webhook para indicar mensagem enviada pelo celular do vendedor */
  _fromMe?: boolean;
  /**
   * Telefone de quem REALMENTE enviou a mensagem (no inbound, o contato; no
   * eco fromMe, o próprio número do canal). Num diálogo interno canal↔canal a
   * conversa é única e pertence a um só dos dois canais, então a direção não
   * pode ser derivada de "quem recebeu o evento" — só o remetente diz se a
   * mensagem é outbound (saiu do canal dono) ou inbound (veio do peer).
   */
  senderPhone?: string;
  /** Nome de exibição do WhatsApp (Baileys pushName) — usado para enriquecer conversas sem cliente vinculado. Só deve vir em mensagens do contato (nunca em eco fromMe, que traz o nome da própria conta). */
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
}): Promise<SaveInboundMessageResult> {
  const [existing] = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waMessageId, data.waMessageId))
    .limit(1);

  if (existing) {
    console.log(`[WA Webhook] Mensagem duplicada ignorada: ${data.waMessageId}`);
    return {
      saved: false,
      conversationId: null,
      direction: null,
      channelId: data.channelId ?? null,
      startsConversation: false,
    };
  }

  // pushName de um eco fromMe é o nome da PRÓPRIA conta conectada (o perfil do
  // canal), não o do contato — passá-lo aqui batizaria a conversa nova com o
  // nome do atendente/canal. Guard redundante com o do handler do Baileys, de
  // propósito: é o último ponto antes da criação da conversa.
  const conv = await findOrCreateConversation(
    data.phone,
    data.channelId,
    data._fromMe ? undefined : data.pushName,
  );

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

  const direction = await resolveMessageDirection(conv, data);

  // Eco de uma mensagem que o próprio CRM acabou de enviar: a linha já existe
  // (gravada por sendConversationMessage/Media) só que ainda sem waMessageId,
  // porque o eco do Baileys pode chegar antes do UPDATE que grava o id. Casa
  // com ela em vez de inserir uma segunda cópia.
  //
  // O guard é `_fromMe`, não `direction === "outbound"`: numa conversa interna
  // o envio do atendente do lado PEER grava `direction: "inbound"` (relativo
  // ao dono), mas `_fromMe` continua `true` no evento capturado pela própria
  // instância que enviou — é esse o sinal de "isto pode ser eco de um envio
  // nosso", em qualquer lado da conversa.
  if (data._fromMe) {
    const backfilled = await backfillEchoedOutboundMessage(conv.id, data);
    if (backfilled) {
      return {
        saved: false,
        conversationId: conv.id,
        direction: "outbound",
        channelId: data.channelId ?? conv.channelId ?? null,
        startsConversation: false,
      };
    }
  }

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
        origin: data._fromMe ? "device" : "contact",
        caption: data.caption ?? null,
        waMessageId: data.waMessageId,
        rawPayload: data.rawPayload ?? null,
        sentAt,
        replyToMessageId,
        replyToContentSnapshot: data.replyToContentSnapshot ?? null,
        replyToTypeSnapshot: data.replyToTypeSnapshot ?? null,
        replyToDirectionSnapshot: data.replyToDirectionSnapshot ?? null,
        isForwarded: data.isForwarded ?? false,
        providerMetadata: data.providerMetadata ?? null,
      })
      .returning({ id: whatsappMessages.id });
  } catch (err: unknown) {
    // Race condition: dois webhooks simultâneos com o mesmo waMessageId
    if ((err as { code?: string }).code === "23505") {
      console.log(`[WA Webhook] Mensagem duplicada ignorada (race): ${data.waMessageId}`);
      return {
        saved: false,
        conversationId: conv.id,
        direction,
        channelId: data.channelId ?? conv.channelId ?? null,
        startsConversation: false,
      };
    }
    throw err;
  }

  if (direction === "inbound") {
    try {
      await routeCampaignReplyToSellerSector(conv.id, conv.clientId, savedMessage.id);
    } catch (err) {
      console.error("[WA Webhook] Falha ao rotear resposta de campanha para setor do vendedor:", err);
    }
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
  let reopened = false;
  if (conv.peerChannelId != null) {
    // O evento sempre pertence à instância local em data.channelId: quando
    // fromMe=true ela é a remetente; caso contrário, é a destinatária.
    // Portanto só essa caixa volta para "Abertas".
    reopened = await reopenActivePerspective(conv.id, data.channelId);
  } else {
    const [reopenedConversation] = await db
      .update(whatsappConversations)
      .set({ status: "open" })
      .where(and(eq(whatsappConversations.id, conv.id), eq(whatsappConversations.status, "closed")))
      .returning({ id: whatsappConversations.id });
    reopened = Boolean(reopenedConversation);
  }

  // NÃO reescreve o channelId da conversa: ele é a identidade da conversa
  // (telefone + canal) e é imutável após a criação por findOrCreateConversation.
  // Um inbound que chegue por outro canal já foi roteado para a conversa daquele
  // canal por findOrCreateConversation(phone, channelId) acima — reescrever aqui
  // sequestraria esta conversa para o canal errado (ex.: conversa da Búzios
  // virando conversa da Dionisio), fazendo o outbound sair pelo número errado.
  const conversationUpdates: Partial<typeof whatsappConversations.$inferInsert> = {
    lastMessageAt: new Date(),
    updatedAt: new Date(),
  };
  if (conv.peerChannelId == null) conversationUpdates.status = "open";
  await db
    .update(whatsappConversations)
    .set(conversationUpdates)
    .where(eq(whatsappConversations.id, conv.id));

  // Setor sai do canal DONO da conversa, não do canal que recebeu o evento —
  // num diálogo interno os dois são diferentes (ver canonicalInternalPair).
  if (conv.channelId != null) {
    await backfillSectorFromChannel(conv.id, conv.channelId);
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
  // como fonte de verdade quando há cliente casado) e quando o outro lado não é
  // um canal nosso (aí o nome exibido vem de peerChannelId, ver
  // listClientsForChat).
  if (!conv.clientId && !conv.peerChannelId) {
    const updates: Partial<typeof whatsappConversations.$inferInsert> = {};

    // pushName só reflete o contato de verdade em mensagens inbound. Em
    // outbound (eco fromMe, ex.: vendedor respondendo direto pelo celular em
    // vez do CRM), o Baileys manda o pushName da PRÓPRIA conta conectada, e
    // usá-lo aqui sobrescreveria o nome do cliente pelo nome do canal.
    if (direction === "inbound" && data.pushName && data.pushName !== (conv as { contactName?: string | null }).contactName) {
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

  return {
    saved: true,
    conversationId: conv.id,
    direction,
    channelId: data.channelId ?? conv.channelId ?? null,
    startsConversation: direction === "inbound" && (reopened || isBrandNew),
  };
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
  direction?: "inbound" | "outbound";
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
          eq(whatsappReactions.direction, data.direction ?? "inbound"),
        ),
      );
  } else {
    await db
      .insert(whatsappReactions)
      .values({
        messageId: targetMsg.id,
        emoji: data.emoji,
        direction: data.direction ?? "inbound",
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

  // Sem `phone` de propósito: o destino da reação sai de
  // resolveOutboundChannelForSender (relativo ao lado que envia), nunca de
  // conv.phone — que é o número do PEER e só serve ao lado dono.
  const [conv] = await db
    .select({ id: whatsappConversations.id, clientId: whatsappConversations.clientId })
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

  // Canal, DIREÇÃO e destino saem de UMA única resolução — mesmo contrato de
  // texto/mídia/template (ver sendConversationMessage). Antes eram duas
  // resoluções independentes (credencial x direção) que podiam divergir: era
  // exatamente esse o bug. Admin/gerente podem "assinar" pela caixa em que
  // estão (channelId); para os demais o override é ignorado aqui, e
  // resolveOutboundChannelForSender só o honra se for um dos DOIS canais do
  // par — não há como reagir por um canal alheio à conversa.
  const actAsChannelId =
    userRole === "admin" || userRole === "gerente" ? channelId : undefined;
  const resolved = await resolveOutboundChannelForSender(conversationId, userId, actAsChannelId);
  if (!resolved) {
    throw new Error(
      "Conversa sem canal de envio configurado — não é possível reagir. Verifique o canal vinculado à conversa.",
    );
  }
  const resolvedChannel = resolved.channel;

  // Destino é o do lado que está reagindo, não conv.phone: conv.phone é o
  // número do PEER (ver canonicalInternalPair), então reagir pelo lado peer
  // mandando para conv.phone seria mandar para o próprio número.
  if (resolvedChannel.provider === "evolution") {
    await evoSendReaction(
      resolvedChannel.evolutionInstanceName,
      resolved.targetPhone,
      targetMsg.waMessageId,
      emoji,
      `reaction-${messageId}-${resolved.direction}`,
    );
  } else {
    await sendReaction(resolved.targetPhone, targetMsg.waMessageId, emoji, {
      phoneNumberId: resolvedChannel.phoneNumberId,
      accessToken: resolvedChannel.accessToken,
    });
  }

  // Direção relativa ao DONO, vinda da MESMA resolução que escolheu o canal —
  // as duas não podem divergir: a linha é unique(messageId, direction) e um
  // onConflictDoUpdate com a direção errada SOBRESCREVE a reação do outro lado.
  const reactionDirection = resolved.direction;

  if (!emoji) {
    await db
      .delete(whatsappReactions)
      .where(
        and(
          eq(whatsappReactions.messageId, messageId),
          eq(whatsappReactions.direction, reactionDirection),
        ),
      );
  } else {
    await db
      .insert(whatsappReactions)
      .values({ messageId, emoji, direction: reactionDirection })
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

/**
 * Canal de saída de uma conversa que está sendo iniciada pelo atendente.
 * Compartilhado por `startConversationByClientId` e `startConversationByPhone`.
 */
async function resolveStartConversationChannel(
  userId: string,
  userRole: string,
  requestedChannelId?: number,
): Promise<number | null> {
  if (requestedChannelId != null) {
    // Canal escolhido explicitamente na tela "Nova conversa" — valida que o
    // usuário realmente tem acesso a ele (dono ou membro, canal ativo) antes
    // de usar, para não permitir iniciar conversa por um canal alheio.
    const accessibleIds =
      userRole === "vendedor"
        ? await listChannelIdsForUser(userId)
        : (await getChannelById(requestedChannelId))
          ? [requestedChannelId]
          : [];
    if (!accessibleIds.includes(requestedChannelId)) {
      throw new Error("CHANNEL_NOT_ACCESSIBLE");
    }
    return requestedChannelId;
  }

  // Sem canal escolhido: usa o canal ativo do atendente que está iniciando a
  // conversa, para que fique isolada das conversas de outros atendentes com
  // o mesmo contato. getActiveChannelIdByUserId só enxerga canal PRÓPRIO
  // (dono); quem só tem acesso concedido via whatsapp_channel_members (canal
  // compartilhado, ex. "Eventos") não é dono de nada e cairia em channelId
  // null — reaproveitando conversas "sem canal" órfãs, que ficam
  // inacessíveis a qualquer vendedor (vendorScopeCondition exige setor E
  // canal preenchidos). Por isso, sem canal próprio, cai para o primeiro
  // canal concedido por membership.
  const ownChannelId = await getActiveChannelIdByUserId(userId);
  return ownChannelId ?? (await listChannelIdsForUser(userId))[0] ?? null;
}

/**
 * Inicia (ou reabre) uma conversa com um número avulso — contato que ainda não
 * é cliente no CRM, ou o próprio número de outro canal nosso (falar com o
 * atendente do canal Eventos, por exemplo). É o caminho equivalente ao "novo
 * contato" do Umbler Talk: sem ele só era possível conversar com quem já estava
 * cadastrado e sob a responsabilidade do vendedor.
 *
 * Se o telefone casar com um cliente existente, `findOrCreateConversation` já
 * faz o vínculo; se casar com um canal nosso, a conversa vira o diálogo interno
 * canônico (ver `canonicalInternalPair`).
 */
export async function startConversationByPhone(
  phone: string,
  userId: string,
  userRole: string,
  requestedChannelId?: number,
) {
  const canonical = canonicalPhone(phone);
  if (!canonical) throw new Error("INVALID_PHONE");

  const channelId = await resolveStartConversationChannel(userId, userRole, requestedChannelId);

  // Falar com o próprio canal não faz sentido (e o WhatsApp trata "nota para
  // si" de forma especial) — recusa em vez de criar uma conversa degenerada.
  if (channelId != null) {
    const own = await getChannelIdentityById(channelId).catch(() => null);
    if (own && isSameChannelPhone(own.displayPhone, phone)) {
      throw new Error("SAME_CHANNEL_PHONE");
    }
  }

  const conv = await findOrCreateConversation(phone, channelId);

  return {
    conversationId: conv.id,
    clientId: conv.clientId,
    clientName: null as string | null,
    phone: conv.phone,
  };
}

export async function startConversationByClientId(
  clientId: string,
  userId: string,
  userRole: string,
  requestedChannelId?: number,
) {
  // Iniciar conversa não é uma ação de carteira: a busca de cliente na tela
  // "Nova conversa" já ignora responsavelId de propósito
  // (ignoreResponsavelScope=true, ver client/src/pages/whatsapp/conversations.tsx
  // e server/repositories/clients.repository.ts:49) para deixar qualquer
  // atendente localizar qualquer cliente do CRM — restringir aqui por
  // responsavelId reintroduziria exatamente o bloqueio que aquela busca foi
  // feita pra evitar, resultando num cliente visível na busca mas que falha
  // ao iniciar ("Cliente não encontrado ou sem permissão").
  const [client] = await db
    .select({ id: clients.id, phone: clients.phone, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.phone) return null;

  const channelId = await resolveStartConversationChannel(userId, userRole, requestedChannelId);

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

/**
 * Marca a conversa como lida para o usuário. `asChannelId` só tem efeito para
 * admin/gerente sobre um diálogo interno, e só quando é um dos dois canais do
 * par (mesma regra de `resolvePerspectiveOverride`, reusada aqui para a
 * perspectiva de LEITURA e a de GRAVAÇÃO nunca poderem divergir) — nesse caso
 * a marcação cobre só aquele lado. Fora disso, grava a marcação da conversa
 * inteira (perspectiveChannelId null), que é o comportamento de sempre.
 * asChannelId inválido é ignorado, não rejeitado — espelha o GET, onde valor
 * inválido cai na perspectiva derivada dos canais do leitor.
 */
export async function markConversationRead(
  userId: string,
  conversationId: string,
  opts: { userRole?: string; asChannelId?: number } = {},
) {
  let perspectiveChannelId: number | null = null;
  if (opts.asChannelId != null && opts.userRole) {
    const [row] = await db
      .select({
        channelId: whatsappConversations.channelId,
        peerChannelId: whatsappConversations.peerChannelId,
      })
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, conversationId))
      .limit(1);
    if (row) {
      perspectiveChannelId = resolvePerspectiveOverride(opts.userRole, row, opts.asChannelId);
    }
  }

  const lastReadAt = new Date();

  // Dois braços porque a chave da linha depende de perspectiveChannelId ser
  // null ou não — cada braço infere o índice único parcial correspondente
  // (ver whatsapp_conversation_reads em shared/schema.ts). Um ON CONFLICT só
  // com as três colunas nunca dispararia na linha null (unique parcial não
  // cobre as duas formas ao mesmo tempo).
  if (perspectiveChannelId == null) {
    await db
      .insert(whatsappConversationReads)
      .values({ userId, conversationId, perspectiveChannelId: null, lastReadAt })
      .onConflictDoUpdate({
        target: [whatsappConversationReads.userId, whatsappConversationReads.conversationId],
        targetWhere: sql`perspective_channel_id IS NULL`,
        set: { lastReadAt },
      });
    return;
  }

  await db
    .insert(whatsappConversationReads)
    .values({ userId, conversationId, perspectiveChannelId, lastReadAt })
    .onConflictDoUpdate({
      target: [
        whatsappConversationReads.userId,
        whatsappConversationReads.conversationId,
        whatsappConversationReads.perspectiveChannelId,
      ],
      targetWhere: sql`perspective_channel_id IS NOT NULL`,
      set: { lastReadAt },
    });
}
