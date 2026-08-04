import { db } from "server/db";
import { eq, and, or, desc, sql, lt, lte, inArray, isNull, isNotNull } from "drizzle-orm";
import {
  whatsappBots,
  whatsappBotNodes,
  whatsappBotEdges,
  whatsappBotSessions,
  whatsappTemplates,
  whatsappConversations,
  whatsappMessages,
  whatsappMedia,
  contactTags,
  clients,
  type Client,
  CONTACT_FIELD_WHITELIST,
  type WhatsappBotNode,
  type WhatsappBotSession,
  type SendMessageNodeData,
  type QuestionNodeData,
  type ConditionNodeData,
  type ConditionBranch,
  type ConditionRule,
  type MenuNodeData,
  type ActionNodeData,
  type FlowFormNodeData,
  type WaitNodeData,
  type ContactFieldKey,
  type BotNodeData,
  type EditTagsNodeData,
  type EndConversationNodeData,
  type DistributeFlowNodeData,
  type SendTemplateNodeData,
  type TransferAgentNodeData,
  type TransferSectorNodeData,
  type TriggerFlowNodeData,
  type StartChannelNodeData,
  users,
  whatsappChannels,
} from "@shared/schema";
import { publishConversationEvent, publishSseEvent, getOnlineUserIds } from "../lib/sse-hub";
import { isGroupJid } from "./baileys/jid";
import { sendTextMessage, sendTemplateMessage, sendFlowMessage, sendMediaByUrl, uploadMedia, sendMediaMessage, sendButtonsMessage, sendListMessage } from "../integrations/whatsapp";
import type { ChannelOverride } from "../integrations/whatsapp";
import { sendText as evoSendText, sendMedia as evoSendMedia } from "../integrations/evolution";
import { toMetaWhatsAppId } from "@shared/phone";
import { canonicalPhone, phoneVariants } from "../lib/phone";
import { getActiveChannelIdByUserId, resolveChannelByUserId, resolveChannelById, resolveChannelForConversation } from "./whatsapp-channels.service";
import type { ResolvedChannel } from "./whatsapp-channels.service";
import { r2, getPublicR2Url } from "../lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { findOrCreateConversation, resolveOutboundChannel, transferConversationToSector } from "./whatsapp-conversations.service";
import { listSectorIdsForUser } from "./whatsapp-sectors.service";
import { classifyMessageIntent } from "../ai-helpers";
import { getAutomaticBotForChannel } from "./whatsapp-bot.service";

const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;
const SESSION_TIMEOUT_MINUTES = 30;

export type StartBotContext =
  | {
      source: "manual";
      conversationId: string;
      channelId: number;
      triggeredByUserId: string;
    }
  | {
      source: "external";
      channelId: number;
      campaignId?: string;
    }
  | {
      source: "campaign";
      channelId: number;
      campaignId: string;
    };

export function nodeAllowsExternalChannel(
  node: { type: string; data: unknown },
  channelId: number,
): boolean {
  if (node.type !== "start_channel") return false;
  const channelIds = (node.data as StartChannelNodeData).channelIds ?? [];
  return channelIds.includes(channelId);
}

export function selectCampaignEntryNode(
  nodes: WhatsappBotNode[],
  edges: Array<{ targetNodeId: string }>,
): WhatsappBotNode | null {
  const explicitEntry =
    nodes.find((node) => node.type === "start_manual" || node.type === "start") ??
    nodes.find((node) => node.type === "start_channel");
  if (explicitEntry) return explicitEntry;

  const nodesWithIncomingEdge = new Set(edges.map((edge) => edge.targetNodeId));
  const rootNodes = nodes
    .filter((node) => !nodesWithIncomingEdge.has(node.id))
    .sort(
      (a, b) =>
        a.positionX - b.positionX ||
        a.positionY - b.positionY ||
        a.id.localeCompare(b.id),
    );
  return rootNodes[0] ?? null;
}

/**
 * Verifica se o contato está dentro da janela de atendimento de 24h da Meta —
 * ou seja, se houve uma mensagem RECEBIDA dele nas últimas 24h. Fora dessa
 * janela a Meta só aceita templates aprovados, não texto livre.
 */
async function isWithinCustomerWindow(
  phone: string,
  channelId?: number,
): Promise<boolean> {
  const digits = phone.replace(/\D+/g, "");
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;

  const [row] = await db
    .select({
      at: sql<Date>`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`,
    })
    .from(whatsappMessages)
    .innerJoin(
      whatsappConversations,
      eq(whatsappMessages.conversationId, whatsappConversations.id),
    )
    .where(
      and(
        eq(whatsappMessages.direction, "inbound"),
        channelId == null
          ? undefined
          : eq(whatsappConversations.channelId, channelId),
        or(
          sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g') = ${digits}`,
          sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g') = ${withoutCountry}`,
        ),
      ),
    )
    .orderBy(
      desc(sql`COALESCE(${whatsappMessages.sentAt}, ${whatsappMessages.createdAt})`),
    )
    .limit(1);

  if (!row?.at) return false;
  return Date.now() - new Date(row.at).getTime() < CUSTOMER_WINDOW_MS;
}

/**
 * Canal da sessão de bot — snapshot gravado por startBotSession logo após
 * resolveBotTriggerChannel. É a identidade de canal que o motor não tem por si
 * só: sem ela, `findOrCreateConversation(phone)` casa a conversa MAIS ANTIGA de
 * QUALQUER canal e a mensagem do bot cai no inbox do atendente errado.
 */
async function botSessionChannelId(sessionId?: string): Promise<number | null> {
  if (!sessionId) return null;
  const [row] = await db
    .select({ channelId: whatsappBotSessions.channelId })
    .from(whatsappBotSessions)
    .where(eq(whatsappBotSessions.id, sessionId))
    .limit(1);
  return row?.channelId ?? null;
}

/**
 * Conversa do bot para este telefone, escopada ao canal da sessão. Sem sessão
 * (ou sessão sem canal) mantém o comportamento antigo de casar por telefone em
 * qualquer canal — é o melhor palpite disponível nesse caso.
 */
async function findBotConversation(phone: string, sessionId?: string) {
  const channelId = await botSessionChannelId(sessionId);
  return findOrCreateConversation(phone, channelId ?? undefined);
}

/**
 * Resolve (sem persistir) o canal por onde a próxima mensagem do bot deve sair.
 * Chamado a cada envio dentro de executeNode — não só no disparo inicial — pois
 * uma sessão de bot segue em turnos futuros (respostas do contato via webhook)
 * que não passam de novo por startBotSession/resolveBotTriggerChannel.
 */
async function resolveBotSendChannel(phone: string, sessionId?: string): Promise<ResolvedChannel | null> {
  const sessionChannelId = await botSessionChannelId(sessionId);
  if (sessionChannelId) {
    const bySession = await resolveChannelById(sessionChannelId).catch(() => null);
    if (bySession) return bySession;
  }
  const conversation = await findOrCreateConversation(phone);
  return resolveChannelForConversation(conversation.id).catch(() => null);
}

/**
 * Resolve o override Cloud API para recursos exclusivos da API oficial da Meta
 * (templates, botões/listas interativas, WhatsApp Flow) sem equivalente no
 * Evolution/Baileys. Se o canal resolvido da conversa for Evolution, lança um
 * erro claro em vez de cair silenciosamente no canal Cloud API global.
 */
async function resolveCloudOnlyChannel(phone: string, featureLabel: string, sessionId?: string): Promise<ChannelOverride | undefined> {
  const resolvedChannel = await resolveBotSendChannel(phone, sessionId);
  if (resolvedChannel?.provider === "evolution") {
    throw new Error(
      `Não é possível enviar ${featureLabel} pelo canal desta conversa: o canal conectado é um número pessoal ` +
        `(Evolution/QR code), que não suporta ${featureLabel} — recurso exclusivo da API oficial da Meta. ` +
        `Vincule a conversa a um canal Cloud API ou ajuste este nó do fluxo.`,
    );
  }
  if (resolvedChannel?.provider === "cloud_api") {
    return { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken };
  }
  return undefined;
}

/**
 * Envia mídia (imagem/documento) pelo canal atualmente resolvido da conversa.
 * Cloud API: lê o objeto e faz upload para a Meta. Evolution: envia somente a
 * URL pública do objeto no R2, evitando transportar o arquivo em Base64/JSON.
 */
async function sendBotMedia(
  phone: string,
  storageKey: string,
  filename: string,
  mimeType: string,
  mediaType: "image" | "document",
  caption?: string,
  sessionId?: string,
): Promise<{ waMessageId: string | null; waMediaId: string | null }> {
  const expectedChannelId = await botSessionChannelId(sessionId);
  const resolvedChannel = await resolveBotSendChannel(phone, sessionId);
  if (resolvedChannel?.provider === "evolution") {
    const evoResult = await evoSendMedia(resolvedChannel.evolutionInstanceName, phone, mediaType, {
      url: getPublicR2Url(storageKey),
      caption,
      filename,
      mimetype: mimeType,
    });
    return { waMessageId: evoResult?.key?.id ?? null, waMediaId: null };
  }
  if (resolvedChannel?.provider === "cloud_api") {
    const windowOpen = await isWithinCustomerWindow(phone, resolvedChannel.id);
    if (!windowOpen) {
      throw new Error(
        "Janela de 24h fechada: a Cloud API da Meta não permite enviar mídia livre para este contato sem template.",
      );
    }
  } else if (expectedChannelId != null) {
    throw new Error("Não foi possível resolver o canal da sessão do bot para enviar mídia");
  } else {
    const windowOpen = await isWithinCustomerWindow(phone);
    if (!windowOpen) {
      throw new Error(
        "Janela de 24h fechada: a Cloud API da Meta não permite enviar mídia livre para este contato sem template.",
      );
    }
  }
  const cloudOverride = resolvedChannel?.provider === "cloud_api"
    ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
    : undefined;
  const buffer = await readR2Buffer(storageKey);
  const waMediaId = await uploadMedia(buffer, filename, mimeType, cloudOverride);
  const result = await sendMediaMessage(phone, waMediaId, mediaType, caption, filename, cloudOverride);
  const waMessageId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
  return { waMessageId, waMediaId };
}

/**
 * Envia texto livre apenas se a janela de 24h estiver aberta. Caso contrário,
 * lança erro descritivo (a Meta rejeitaria o envio) — o primeiro contato a frio
 * precisa ser feito por template aprovado.
 */
async function sendFreeText(phone: string, text: string, sessionId?: string): Promise<string | null> {
  const expectedChannelId = await botSessionChannelId(sessionId);
  const resolvedChannel = await resolveBotSendChannel(phone, sessionId);
  if (resolvedChannel?.provider === "evolution") {
    const evoResult = await evoSendText(resolvedChannel.evolutionInstanceName, phone, text);
    return evoResult?.key?.id ?? null;
  }
  if (resolvedChannel?.provider === "cloud_api") {
    const windowOpen = await isWithinCustomerWindow(phone, resolvedChannel.id);
    if (!windowOpen) {
      throw new Error(
        "Janela de 24h fechada: a Cloud API da Meta não permite enviar texto livre para este contato. " +
          "Configure a abertura do bot com um template aprovado.",
      );
    }
  } else if (expectedChannelId != null) {
    throw new Error("Não foi possível resolver o canal da sessão do bot para enviar texto");
  } else {
    const windowOpen = await isWithinCustomerWindow(phone);
    if (!windowOpen) {
      throw new Error(
        "Janela de 24h fechada: a Cloud API da Meta não permite enviar texto livre para este contato.",
      );
    }
  }
  const cloudOverride = resolvedChannel?.provider === "cloud_api"
    ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
    : undefined;
  const result = await sendTextMessage(phone, text, cloudOverride);
  return (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
}

interface PersistBotMessageOptions {
  waMessageId: string | null;
  type?: "text" | "image" | "document" | "template";
  content?: string | null;
  caption?: string | null;
  rawPayload?: unknown;
  /**
   * Sessão de bot que originou a mensagem — dá o canal por onde ela saiu e, com
   * isso, em QUAL conversa gravá-la. Sem ela a mensagem cai na conversa mais
   * antiga deste telefone em qualquer canal, ou seja, possivelmente no inbox de
   * outro atendente. Os chamadores fora do motor (confirmação de opt-out/opt-in)
   * não têm sessão e mantêm o comportamento antigo.
   */
  sessionId?: string;
  media?: {
    storageKey: string;
    waMediaId?: string | null;
    mimeType?: string;
    filename?: string;
  };
}

export async function persistBotMessage(
  phone: string,
  options: PersistBotMessageOptions,
): Promise<void> {
  try {
    const conversation = await findBotConversation(phone, options.sessionId);
    const msgType = options.type ?? "text";
    const hasContent = msgType === "text" || msgType === "template";
    const [saved] = await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      channelId: conversation.channelId ?? null,
      waMessageId: options.waMessageId ?? undefined,
      direction: "outbound",
      type: msgType,
      content: hasContent ? (options.content ?? null) : null,
      caption: hasContent ? null : (options.caption ?? null),
      rawPayload: options.rawPayload ?? null,
      status: "sent",
      sentAt: new Date(),
    }).returning({ id: whatsappMessages.id });

    if (options.media) {
      await db.insert(whatsappMedia).values({
        messageId: saved.id,
        whatsappMediaId: options.media.waMediaId ?? null,
        storageKey: options.media.storageKey,
        mimeType: options.media.mimeType ?? null,
        filename: options.media.filename ?? null,
      });
    }

    await db
      .update(whatsappConversations)
      .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversation.id));

    publishConversationEvent(conversation.id, "new_message", { clientId: conversation.clientId ?? null });
  } catch (err) {
    console.error("[WaBot] Erro ao persistir mensagem do bot:", err);
  }
}

async function getActiveSession(
  phone: string,
): Promise<WhatsappBotSession | null> {
  const [session] = await db
    .select()
    .from(whatsappBotSessions)
    .where(
      and(
        eq(whatsappBotSessions.phoneNumber, toMetaWhatsAppId(phone)),
        eq(whatsappBotSessions.status, "active"),
      ),
    )
    .limit(1);
  return session ?? null;
}

async function getNode(nodeId: string): Promise<WhatsappBotNode | null> {
  const [node] = await db
    .select()
    .from(whatsappBotNodes)
    .where(eq(whatsappBotNodes.id, nodeId))
    .limit(1);
  return node ?? null;
}

async function getNextNode(
  botId: string,
  sourceNodeId: string,
  sourceHandle?: string,
): Promise<WhatsappBotNode | null> {
  const edges = await db
    .select()
    .from(whatsappBotEdges)
    .where(
      and(
        eq(whatsappBotEdges.botId, botId),
        eq(whatsappBotEdges.sourceNodeId, sourceNodeId),
      ),
    );

  // Quando um handle é especificado (nós de ramificação: send_template,
  // condition, menu, distribute), só seguir a aresta daquele handle. Sem aresta
  // = parar aqui — NÃO cair na primeira aresta, que dispararia uma ramificação
  // errada (ex: enviar o nó de um botão sem o contato ter clicado).
  if (sourceHandle) {
    console.log(
      `[WaBot][Condition] getNextNode: sourceNode=${sourceNodeId} sourceHandle=${sourceHandle} arestas=${JSON.stringify(edges.map((e) => ({ sourceHandle: e.sourceHandle, targetNodeId: e.targetNodeId })))}`,
    );
    const edge = edges.find((e) => e.sourceHandle === sourceHandle);
    return edge ? getNode(edge.targetNodeId) : null;
  }

  // Nós lineares (sem handle): seguir a única aresta de saída.
  const edge = edges[0];
  return edge ? getNode(edge.targetNodeId) : null;
}

// Motivos canônicos de finalização de uma sessão de bot, usados no relatório
// "Motivos de finalização dos bots" da página de detalhes da campanha.
export type BotSessionCompletionReason =
  | "end_of_flow"
  | "end_conversation"
  | "transferred_to_agent"
  | "transferred_to_sector"
  | "handed_off_to_bot"
  | "timed_out"
  | "delivery_failed"
  | "unsupported_node"
  | "opted_out"
  | "closed_by_agent"
  | "bot_deleted";

async function updateSession(
  sessionId: string,
  data: {
    currentNodeId?: string;
    status?: "active" | "completed" | "timed_out" | "failed";
    completedAt?: Date;
    sessionData?: Record<string, string>;
    resumeAt?: Date | null;
    pendingMessageId?: string | null;
    responseDeadlineAt?: Date | null;
    completionReason?: BotSessionCompletionReason | null;
    channelId?: number | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  await db
    .update(whatsappBotSessions)
    .set({ ...data, lastActivityAt: new Date() })
    .where(eq(whatsappBotSessions.id, sessionId));
}

/**
 * Marca uma sessão de bot como falha e persiste o erro — chamado sempre que
 * a execução de um nó lança uma exceção não tratada em qualquer ponto do
 * ciclo de vida da sessão (disparo inicial, resposta de webhook, job de
 * retomada, timeout de template). Não relança — quem chama decide se relança.
 */
async function markSessionFailed(sessionId: string, err: unknown): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  try {
    await updateSession(sessionId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: errorMessage.slice(0, 4000),
    });
  } catch (updateErr) {
    console.error("[BotEngine] Falha ao persistir status=failed da sessão:", updateErr);
  }
}

/**
 * Encerra a sessão de bot ativa (se houver) para um telefone que acabou de
 * optar por não receber mais mensagens de marketing.
 */
export async function terminateActiveSessionForOptOut(phone: string): Promise<void> {
  const session = await getActiveSession(phone);
  if (!session) return;
  await updateSession(session.id, {
    status: "completed",
    completedAt: new Date(),
    completionReason: "opted_out",
  });
}

/**
 * Encerra a sessão de bot ativa (se houver) quando um atendente encerra
 * manualmente a conversa — sem isso, a sessão fica "Em execução" para sempre
 * no histórico de bots até o timeout por inatividade expirá-la.
 */
export async function terminateActiveSessionForConversationClose(phone: string): Promise<void> {
  const session = await getActiveSession(phone);
  if (!session) return;
  await updateSession(session.id, {
    status: "completed",
    completedAt: new Date(),
    completionReason: "closed_by_agent",
  });
}

export type TransferAgentCtx = {
  currentConversationAgentId: string | null;
  clientPreviousAgentId: string | null;
  attendantIds: string[];
  rng: () => number;
};

export function resolveTransferAgent(
  data: TransferAgentNodeData,
  ctx: TransferAgentCtx,
): string | null {
  switch (data.rule) {
    case "specific":
      return data.agentId ?? null;
    case "previous_same_conversation":
      return ctx.currentConversationAgentId;
    case "previous_conversation":
      return ctx.clientPreviousAgentId;
    case "any_available":
    case "random": {
      if (ctx.attendantIds.length === 0) return null;
      const idx = Math.floor(ctx.rng() * ctx.attendantIds.length);
      return ctx.attendantIds[idx];
    }
    default:
      return null;
  }
}

export type TransferSectorCtx = {
  currentConversationSectorId: string | null;
  clientPreviousSectorId: string | null;
};

export function resolveTransferSector(
  data: TransferSectorNodeData,
  ctx: TransferSectorCtx,
): string | null {
  switch (data.rule) {
    case "specific":
      return data.sectorId ?? null;
    case "previous_same_conversation":
      return ctx.currentConversationSectorId;
    case "previous_conversation":
      return ctx.clientPreviousSectorId;
    default:
      return null;
  }
}

export function pickDistributeHandle(
  outputs: Array<{ handle: string; percentage: number }>,
  rng: () => number,
): string | null {
  if (outputs.length === 0) return null;
  const total = outputs.reduce((sum, o) => sum + o.percentage, 0);
  const r = rng() * total;
  let cursor = 0;
  for (const o of outputs) {
    cursor += o.percentage;
    if (r < cursor) return o.handle;
  }
  return outputs[outputs.length - 1].handle;
}

export function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

/** Monta o mapa de variáveis de personalização a partir dos dados de um cliente. */
export function buildClientVariables(client: Client | null, phone: string): Record<string, string> {
  const vars: Record<string, string> = {
    nome: "",
    variavel: "",
    email: "",
    telefone: phone,
    telefone_fixo: "",
    cpf: "",
    instagram: "",
    aniversario: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    categoria: "",
    origem: "",
    nome_fantasia: "",
    inscricao_estadual: "",
  };
  if (!client) return vars;
  if (client.name) {
    vars.nome = client.name;
    // Compatibilidade com bots antigos que usavam o placeholder genérico sugerido pelo editor.
    // Uma resposta capturada com esse nome continua podendo substituir o valor durante a sessão.
    vars.variavel = client.name;
  }
  if (client.email) vars.email = client.email;
  if (client.cpf) vars.cpf = client.cpf;
  if (client.birthday) vars.aniversario = client.birthday;
  if (client.city) vars.cidade = client.city;
  if (client.state) vars.estado = client.state;
  if (client.fixedPhone) vars.telefone_fixo = client.fixedPhone;
  if (client.address) vars.endereco = client.address;
  if (client.neighborhood) vars.bairro = client.neighborhood;
  if (client.instagram) vars.instagram = client.instagram;
  if (client.cep) vars.cep = client.cep;
  if (client.number) vars.numero = client.number;
  if (client.complement) vars.complemento = client.complement;
  if (client.categoria) vars.categoria = client.categoria;
  if (client.origem) vars.origem = client.origem;
  if (client.nomeFantasia) vars.nome_fantasia = client.nomeFantasia;
  if (client.inscricaoEstadual) vars.inscricao_estadual = client.inscricaoEstadual;
  return vars;
}

/** Valida os 11 dígitos de um CPF (dígitos verificadores). */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i], 10) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === parseInt(digits[9], 10) && calc(10) === parseInt(digits[10], 10);
}

/**
 * Valida a resposta do contato conforme o tipo configurado no nó de Pergunta.
 * Retorna true quando válida (ou quando não há validação).
 */
export function validateAnswer(
  value: string,
  validation: QuestionNodeData["validation"],
): boolean {
  const v = value.trim();
  if (!validation || validation === "none") return true;
  switch (validation) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case "cpf":
      return isValidCpf(v);
    case "phone":
      return v.replace(/\D/g, "").length >= 10;
    case "number":
      return /^-?\d+(?:[.,]\d+)?$/.test(v);
    case "date":
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(v) ||
        /^\d{2}\/\d{2}\/\d{4}$/.test(v)
      );
    default:
      return true;
  }
}

/**
 * Adiciona etiquetas do WhatsApp (`whatsappTags`, selecionadas no editor de bot
 * via `/api/whatsapp/tags`) ao contato, sem duplicar (idempotente).
 *
 * `contactTags.whatsappTagId` — não `tagId` (etiquetas internas do CRM,
 * outra tabela) — é a coluna correta aqui: é o espaço de IDs que o editor
 * de bot realmente oferece para este nó.
 */
async function addContactTags(clientId: string, whatsappTagIds: string[]): Promise<void> {
  const ids = whatsappTagIds.filter(Boolean);
  if (ids.length === 0) return;
  await db
    .delete(contactTags)
    .where(and(eq(contactTags.clientId, clientId), inArray(contactTags.whatsappTagId, ids)));
  await db
    .insert(contactTags)
    .values(ids.map((whatsappTagId) => ({ clientId, whatsappTagId })))
    .onConflictDoNothing();
}

/** Remove etiquetas do WhatsApp do contato (ver `addContactTags`). */
async function removeContactTags(clientId: string, whatsappTagIds: string[]): Promise<void> {
  const ids = whatsappTagIds.filter(Boolean);
  if (ids.length === 0) return;
  await db
    .delete(contactTags)
    .where(and(eq(contactTags.clientId, clientId), inArray(contactTags.whatsappTagId, ids)));
}

/** Lê um objeto do R2 e retorna seu conteúdo como Buffer. */
async function readR2Buffer(storageKey: string): Promise<Buffer> {
  const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";
  const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }));
  if (!obj.Body) {
    throw new Error(`[BotEngine] Arquivo não encontrado no storage: ${storageKey}`);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of obj.Body as NodeJS.ReadableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

class BotNodeExecutionError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly nodeType: string,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Falha no nó "${nodeId}" (${nodeType}): ${detail}`);
    this.name = "BotNodeExecutionError";
    (this as Error & { cause?: unknown }).cause = cause;
  }
}

async function executeNode(
  node: WhatsappBotNode,
  phone: string,
  sessionId: string,
  botId: string,
  variables: Record<string, string> = {},
): Promise<string | null> {
  const data = node.data as BotNodeData;
  // Rastreia o último waMessageId enviado na cadeia síncrona de nós, para que
  // o chamador (startBotSession) consiga persistir o id em whatsappCampaignMessages
  // e o webhook de status da Meta consiga corrigir o status depois.
  let lastMessageId: string | null = null;

  try {
    switch (node.type) {
    case "start":
    case "start_manual":
    case "start_channel": {
      const next = await getNextNode(botId, node.id);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "send_message": {
      const d = data as SendMessageNodeData;
      if (d.messageType === "template") {
        const cloudOverride = await resolveCloudOnlyChannel(phone, "templates", sessionId);
        try {
          if (d.metaTemplateName) {
            const interpolatedParams = (d.templateParams ?? []).map((component) => ({
              ...component,
              parameters: component.parameters.map((param) => {
                if (param.type === "text") {
                  return { ...param, text: interpolate(param.text, variables) };
                }
                return param;
              }),
            }));

            // Quando há mídia de header enviada por upload, envia pelo link público
            // do R2 (CDN Cloudflare). A URL precisa ser baixável pelo Meta — a URL de
            // exemplo da própria Meta não é (retorna 403).
            const components: object[] = interpolatedParams.filter(
              (c) => !(d.templateHeaderMedia?.storageKey && c.type === "header"),
            );
            if (d.templateHeaderMedia?.storageKey) {
              const m = d.templateHeaderMedia;
              const link = getPublicR2Url(m.storageKey);
              components.unshift({
                type: "header",
                parameters: [{ type: m.type, [m.type]: { link } }],
              });
            }

            const result = await sendTemplateMessage(
              phone,
              d.metaTemplateName,
              d.metaTemplateLanguage ?? "pt_BR",
              components,
              cloudOverride,
            );
            const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
            await persistBotMessage(phone, {
              waMessageId: waId,
              type: "template",
              content: `Template: ${d.metaTemplateName}`,
              rawPayload: { kind: "bot_template", templateName: d.metaTemplateName, language: d.metaTemplateLanguage ?? "pt_BR", components },
              sessionId,
            });
            lastMessageId = waId;
          } else if (d.templateId) {
            const [tpl] = await db
              .select()
              .from(whatsappTemplates)
              .where(eq(whatsappTemplates.id, d.templateId))
              .limit(1);
            if (tpl) {
              const bodyParams = Array.isArray(tpl.bodyParams) ? tpl.bodyParams as string[] : [];
              const components = bodyParams.length > 0
                ? [{
                    type: "body",
                    parameters: bodyParams.map((p) => ({ type: "text", text: interpolate(p, variables) })),
                  }]
                : [];
              const result = await sendTemplateMessage(phone, tpl.name, tpl.languageCode, components, cloudOverride);
              const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
              await persistBotMessage(phone, {
                waMessageId: waId,
                type: "template",
                content: `Template: ${tpl.name}`,
                rawPayload: { kind: "bot_template", templateName: tpl.name, language: tpl.languageCode, components },
                sessionId,
              });
              lastMessageId = waId;
            } else {
              throw new Error(`Template interno ${d.templateId} não encontrado`);
            }
          }
        } catch (err) {
          const templateName = d.metaTemplateName ?? d.templateId ?? "desconhecido";
          console.error(`[BotEngine] Falha ao enviar template "${templateName}" para ${phone}:`, err);
          throw new Error(`Falha ao enviar template "${templateName}": verifique se os parâmetros do nó estão configurados corretamente no editor do bot.`);
        }
      } else {
        const text = d.text ? interpolate(d.text, variables) : undefined;
        if (d.attachment?.storageKey) {
          const mimeType = d.attachment.mimeType ?? (d.attachment.type === "image" ? "image/jpeg" : "application/octet-stream");
          const filename = d.attachment.name ?? d.attachment.storageKey.split("/").pop() ?? "file";
          const { waMessageId: waId, waMediaId: mediaId } = await sendBotMedia(
            phone,
            d.attachment.storageKey,
            filename,
            mimeType,
            d.attachment.type,
            text,
            sessionId,
          );
          await persistBotMessage(phone, {
            waMessageId: waId,
            type: d.attachment.type,
            caption: text ?? null,
            sessionId,
            media: {
              storageKey: d.attachment.storageKey,
              waMediaId: mediaId,
              mimeType,
              filename,
            },
          });
          lastMessageId = waId;
          // Se há texto E anexo, o texto virou legenda. Não enviar mensagem separada.
        } else if (text) {
          const waId = await sendFreeText(phone, text, sessionId);
          await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text, sessionId });
          lastMessageId = waId;
        }
      }
      const next = await getNextNode(botId, node.id);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "question": {
      const d = data as QuestionNodeData;
      if (d.messageText) {
        const text = interpolate(d.messageText, variables);
        const waId = await sendFreeText(phone, text, sessionId);
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text, sessionId });
        lastMessageId = waId;
      }
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "condition": {
      const c = data as ConditionNodeData;
      console.log(
        `[WaBot][Condition] executeNode: node=${node.id} mode=${c.mode ?? "(reply)"} rules=${JSON.stringify(c.rules)} branches=${JSON.stringify(c.branches)} defaultHandle=${c.defaultHandle}`,
      );
      // Modo "attribute": ramifica imediatamente pelos atributos do contato
      // (etiqueta/campo), sem aguardar resposta. O fluxo segue na hora.
      if (c.mode === "attribute") {
        const conversation = await findBotConversation(phone, sessionId);
        const handle = await resolveAttributeHandle(node, conversation.clientId);
        console.log(`[WaBot][Condition] modo attribute: clientId=${conversation.clientId} handle=${handle}`);
        const next = await getNextConditionNode(botId, node, handle);
        console.log(`[WaBot][Condition] modo attribute: próximo nó=${next?.id ?? "(nenhum — encerrando)"}`);
        if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        else await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
        break;
      }
      // Regras só de atributo (sem "Mensagem contém") não dependem de uma
      // resposta do contato: avaliar imediatamente e seguir. Numa campanha,
      // uma condição por etiqueta não pode travar o fluxo esperando mensagem.
      // (Isto não reintroduz a regressão de reinício de fluxo: nada aqui
      // consome a mensagem do contato — só atributos já conhecidos.)
      if (!conditionRulesNeedReply(c)) {
        const ruleCtx = await loadConditionRuleContext({
          phone,
          sessionId,
          rules: c.rules ?? [],
        });
        // As variáveis correntes da execução são mais frescas que o
        // sessionData persistido (podem incluir capturas ainda não gravadas).
        ruleCtx.sessionVariables = variables;
        const matched = evaluateConditionRules(c.rules ?? [], ruleCtx);
        const handle = matched ? "match" : conditionDefaultHandle(c);
        console.log(`[WaBot][Condition] avaliação imediata (sem regra de mensagem): handle=${handle}`);
        const next = await getNextConditionNode(botId, node, handle);
        if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        else await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
        break;
      }
      // Há regra de mensagem (ou modelo legado branches/useAI): pausa e aguarda
      // a resposta do contato; a ramificação é resolvida em
      // handleIncomingMessage quando a próxima mensagem chega. Sem isso, a
      // condição cairia no primeiro edge e o fluxo seria reiniciado a cada
      // resposta (reenviando o template).
      console.log(`[WaBot][Condition] modo reply: pausando no nó ${node.id}, aguardando resposta do contato`);
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "menu": {
      const d = data as MenuNodeData;
      const options = (d.options ?? []).filter((o) => o.label?.trim());
      if (options.length === 0) {
        // Pausar sem ter enviado nada deixaria a sessão presa aguardando uma
        // escolha que o contato nunca viu — falhar explicitamente.
        throw new Error("Nó de menu sem opções configuradas — adicione opções no editor do bot.");
      }
      if (options.length > 0) {
        const body = interpolate(d.bodyText || "", variables) || "Escolha uma opção:";
        const useButtons =
          d.renderAs === "buttons" || (d.renderAs !== "list" && options.length <= 3);
        const opts = {
          headerText: d.headerText ? interpolate(d.headerText, variables) : undefined,
          footerText: d.footerText ? interpolate(d.footerText, variables) : undefined,
        };
        const cloudOverride = await resolveCloudOnlyChannel(phone, "menus interativos (botões/lista)", sessionId);
        const channelId = await botSessionChannelId(sessionId);
        const windowOpen = await isWithinCustomerWindow(phone, channelId ?? undefined);
        if (!windowOpen) {
          throw new Error(
            "Janela de 24h fechada: a Cloud API da Meta não permite enviar menus interativos sem uma mensagem recebida do contato.",
          );
        }
        let waId: string | null = null;
        if (useButtons) {
          const result = await sendButtonsMessage(
            phone,
            body,
            options.slice(0, 3).map((o) => ({ id: o.handle, title: o.label })),
            opts,
            cloudOverride,
          );
          waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
        } else {
          const result = await sendListMessage(
            phone,
            body,
            d.listButtonText || "Escolher",
            options.slice(0, 10).map((o) => ({ id: o.handle, title: o.label, description: o.description })),
            opts,
            cloudOverride,
          );
          waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
        }
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: body, sessionId });
        lastMessageId = waId;
      }
      // Pausa aguardando a escolha do contato (resolvida em handleIncomingMessage).
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "flow_form": {
      const d = data as FlowFormNodeData;
      if (!d.flowId) {
        // Sem Flow selecionado o nó não tem como pausar nem coletar dados —
        // falhar explicitamente em vez de deixar a sessão em estado inconsistente.
        throw new Error(
          "Nó de formulário sem WhatsApp Flow selecionado — configure o formulário no editor do bot.",
        );
      }
      if (d.flowId) {
        const cloudOverride = await resolveCloudOnlyChannel(phone, "formulários (WhatsApp Flow)", sessionId);
        const result = await sendFlowMessage(phone, d.flowId, d.ctaText || "Abrir formulário", {
          bodyText: d.bodyText,
          flowToken: d.flowToken,
        }, cloudOverride);
        const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: `[Formulário: ${d.flowName || d.flowId}]`, sessionId });
        lastMessageId = waId;
        // Aguarda a resposta do Flow — o session fica no nó atual
        await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      }
      break;
    }

    case "action": {
      const d = data as ActionNodeData;
      if (d.actionType === "end_conversation") {
        await updateSession(sessionId, {
          status: "completed",
          completedAt: new Date(),
          completionReason: "end_conversation",
        });
        return null;
      }

      const conversation = await findBotConversation(phone, sessionId);
      switch (d.actionType) {
        case "assign_agent": {
          if (d.agentId) {
            await db
              .update(whatsappConversations)
              .set({ assignedAgentId: d.agentId, updatedAt: new Date() })
              .where(eq(whatsappConversations.id, conversation.id));
          }
          break;
        }
        case "add_tag": {
          // Legado: mantido por compatibilidade; preferir edit_tags.
          if (d.tagId && conversation.clientId) {
            await addContactTags(conversation.clientId, [d.tagId]);
          }
          break;
        }
        case "edit_tags": {
          if (conversation.clientId) {
            if (d.addTagIds?.length)
              await addContactTags(conversation.clientId, d.addTagIds);
            if (d.removeTagIds?.length)
              await removeContactTags(conversation.clientId, d.removeTagIds);
          }
          break;
        }
        case "notify_agent": {
          const targetAgent = d.notifyAgentId || conversation.assignedAgentId;
          if (targetAgent) {
            publishSseEvent(
              "bot_notification",
              {
                conversationId: conversation.id,
                clientId: conversation.clientId ?? null,
                message: interpolate(d.notifyMessage ?? "", variables),
              },
              targetAgent,
            );
          }
          break;
        }
        case "create_note": {
          if (d.noteText) {
            await db.insert(whatsappMessages).values({
              conversationId: conversation.id,
              direction: "outbound",
              type: "note",
              content: interpolate(d.noteText, variables),
              status: "sent",
              sentAt: new Date(),
            });
            publishConversationEvent(conversation.id, "new_message", {
              clientId: conversation.clientId ?? null,
            });
          }
          break;
        }
        case "transfer_sector": {
          if (d.sectorId) {
            // Usa transferConversationToSector (mesma função do node dedicado
            // transfer_sector e da transferência manual) para garantir que
            // assignedAgentId seja zerado — sem isso, o atendente anterior
            // continuaria vendo a conversa por posse direta mesmo fora do
            // setor/canal do novo destino.
            await transferConversationToSector(conversation.id, d.sectorId);
          }
          break;
        }
        case "set_waiting": {
          await db
            .update(whatsappConversations)
            .set({ status: d.waitingStatus || "waiting", updatedAt: new Date() })
            .where(eq(whatsappConversations.id, conversation.id));
          break;
        }
        case "set_contact_field": {
          if (
            d.contactField &&
            conversation.clientId &&
            CONTACT_FIELD_WHITELIST.includes(d.contactField as ContactFieldKey)
          ) {
            const value = interpolate(d.contactFieldValue ?? "", variables);
            await db
              .update(clients)
              .set({ [d.contactField]: value } as Partial<typeof clients.$inferInsert>)
              .where(eq(clients.id, conversation.clientId));
          }
          break;
        }
      }

      const next = await getNextNode(botId, node.id);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "wait": {
      const d = data as WaitNodeData;
      let resumeAt: Date | null = null;
      if (d.mode === "interval" && d.seconds && d.seconds > 0) {
        resumeAt = new Date(Date.now() + d.seconds * 1000);
      } else if (d.mode === "until" && d.untilAt) {
        const parsed = new Date(d.untilAt);
        if (!Number.isNaN(parsed.getTime())) resumeAt = parsed;
      }

      if (!resumeAt || resumeAt.getTime() <= Date.now()) {
        // Sem espera válida (ou já passou): segue o fluxo imediatamente.
        const next = await getNextNode(botId, node.id);
        if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        break;
      }

      // Pausa a sessão: o job resume-bot-sessions retoma a partir deste nó.
      await updateSession(sessionId, {
        currentNodeId: node.id,
        sessionData: variables,
        resumeAt,
      });
      break;
    }

    case "send_template": {
      const d = data as SendTemplateNodeData;
      if (!d.metaTemplateName) break;

      if (d.headerMediaType && !d.templateHeaderMedia?.storageKey) {
        const what = d.headerMediaType === "image" ? "uma imagem" : d.headerMediaType === "video" ? "um vídeo" : "um documento";
        throw new Error(
          `O template "${d.metaTemplateName}" exige ${what} no cabeçalho. Configure o arquivo no nó "Enviar template" do editor do bot.`,
        );
      }

      const components: object[] = [];
      if (d.templateParams?.length) {
        components.push({
          type: "body",
          parameters: d.templateParams.map((p) => ({
            type: "text",
            text: interpolate(p, variables),
          })),
        });
      }
      if (d.templateHeaderMedia?.storageKey) {
        const m = d.templateHeaderMedia;
        components.unshift({
          type: "header",
          parameters: [{ type: m.type, [m.type]: { link: getPublicR2Url(m.storageKey) } }],
        });
      }

      const cloudOverride = await resolveCloudOnlyChannel(phone, "templates", sessionId);
      let result: Awaited<ReturnType<typeof sendTemplateMessage>>;
      try {
        result = await sendTemplateMessage(
          phone,
          d.metaTemplateName,
          d.metaTemplateLanguage ?? "pt_BR",
          components,
          cloudOverride,
        );
      } catch (err) {
        console.error("[BotEngine] Falha ao enviar template:", err);
        throw new Error(`Falha ao enviar template "${d.metaTemplateName}": ${err instanceof Error ? err.message : String(err)}`);
      }
      const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
      await persistBotMessage(phone, {
        waMessageId: waId,
        type: "template",
        content: `Template: ${d.metaTemplateName}`,
        rawPayload: { kind: "bot_template", templateName: d.metaTemplateName, language: d.metaTemplateLanguage ?? "pt_BR", components },
        sessionId,
      });
      lastMessageId = waId;

      const deadline = d.noResponseHandle
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

      await updateSession(sessionId, {
        currentNodeId: node.id,
        pendingMessageId: waId,
        responseDeadlineAt: deadline,
      });
      break;
    }

    case "trigger_flow": {
      const d = data as TriggerFlowNodeData;
      await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "handed_off_to_bot" });
      if (d.targetBotId) {
        const sourceChannelId = await botSessionChannelId(sessionId);
        if (!sourceChannelId) {
          throw new Error("Não foi possível determinar o canal da sessão ao encaminhar para outro bot");
        }
        await startBotSession(
          d.targetBotId,
          phone,
          d.targetNodeId,
          undefined,
          sourceChannelId,
          undefined,
          {
            source: "external",
            channelId: sourceChannelId,
          },
        );
      }
      break;
    }

    case "transfer_agent": {
      const d = data as TransferAgentNodeData;
      const conversation = await findBotConversation(phone, sessionId);

      // Busca o agente da conversa anterior do cliente (para regra previous_conversation)
      let clientPreviousAgentId: string | null = null;
      if (d.rule === "previous_conversation" && conversation.clientId) {
        const [prev] = await db
          .select({ assignedAgentId: whatsappConversations.assignedAgentId })
          .from(whatsappConversations)
          .where(
            and(
              eq(whatsappConversations.clientId, conversation.clientId),
              // exclui a conversa atual
              sql`${whatsappConversations.id} != ${conversation.id}`,
            ),
          )
          .orderBy(desc(whatsappConversations.createdAt))
          .limit(1);
        clientPreviousAgentId = prev?.assignedAgentId ?? null;
      }

      // Busca atendentes (vendedor e gerente) para regras any_available/random
      const attendantRows = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, "vendedor"), eq(users.role, "gerente")));
      const attendantIds = attendantRows.map((r) => r.id);

      let agentId = resolveTransferAgent(d, {
        currentConversationAgentId: conversation.assignedAgentId ?? null,
        clientPreviousAgentId,
        attendantIds,
        rng: Math.random,
      });

      // Toggle de permissão: só transfere se o agente ALVO for membro do setor
      // atual da conversa (paridade com transfer_sector). Conversa sem setor
      // não bloqueia — não há o que checar.
      if (agentId && d.onlyIfCurrentHasPermission && conversation.sectorId) {
        const memberSectorIds = await listSectorIdsForUser(agentId);
        if (!memberSectorIds.includes(conversation.sectorId)) agentId = null;
      }

      if (agentId) {
        // Vincula a conversa ao canal do atendente (se houver), para que as
        // respostas saiam pelo número dele.
        const agentChannelId = await getActiveChannelIdByUserId(agentId).catch(() => null);
        await db
          .update(whatsappConversations)
          .set({
            assignedAgentId: agentId,
            ...(agentChannelId ? { channelId: agentChannelId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(whatsappConversations.id, conversation.id));
        await db.insert(whatsappMessages).values({
          conversationId: conversation.id,
          direction: "outbound",
          type: "system",
          content: "🤖 Atendimento transferido para agente pelo bot",
          status: "sent",
          sentAt: new Date(),
        });
        await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "transferred_to_agent" });
      } else if (d.activateFlowIfFailed) {
        const next = await getNextNode(botId, node.id);
        if (next) {
          lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        } else {
          await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
        }
      } else {
        await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
      }
      break;
    }

    case "transfer_sector": {
      const d = data as TransferSectorNodeData;
      const conversation = await findBotConversation(phone, sessionId);

      // Busca o setor da conversa anterior do cliente (para regra previous_conversation)
      let clientPreviousSectorId: string | null = null;
      if (d.rule === "previous_conversation" && conversation.clientId) {
        const [prev] = await db
          .select({ sectorId: whatsappConversations.sectorId })
          .from(whatsappConversations)
          .where(
            and(
              eq(whatsappConversations.clientId, conversation.clientId),
              // exclui a conversa atual
              sql`${whatsappConversations.id} != ${conversation.id}`,
            ),
          )
          .orderBy(desc(whatsappConversations.createdAt))
          .limit(1);
        clientPreviousSectorId = prev?.sectorId ?? null;
      }

      let sectorId = resolveTransferSector(d, {
        currentConversationSectorId: conversation.sectorId ?? null,
        clientPreviousSectorId,
      });

      // Toggle de permissão: só transfere se o atendente atual da conversa for
      // membro do setor alvo. Sem atendente atribuído ainda, não há o que checar.
      if (sectorId && d.onlyIfCurrentHasPermission && conversation.assignedAgentId) {
        const memberSectorIds = await listSectorIdsForUser(conversation.assignedAgentId);
        if (!memberSectorIds.includes(sectorId)) sectorId = null;
      }

      if (sectorId) {
        await transferConversationToSector(conversation.id, sectorId);
        await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "transferred_to_sector" });
      } else if (d.activateFlowIfFailed) {
        const next = await getNextNode(botId, node.id);
        if (next) {
          lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        } else {
          await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
        }
      } else {
        await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
      }
      break;
    }

    case "distribute_flow": {
      const d = data as DistributeFlowNodeData;
      if (!d.outputs?.length) {
        console.warn("[BotEngine] distribute_flow sem outputs — avançando pela primeira aresta disponível");
      }
      const handle = pickDistributeHandle(d.outputs ?? [], Math.random);
      const next = await getNextNode(botId, node.id, handle ?? undefined);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "end_conversation": {
      const d = data as EndConversationNodeData;
      const conversation = await findBotConversation(phone, sessionId);
      await db
        .update(whatsappConversations)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(whatsappConversations.id, conversation.id));

      let closedByText = "bot";
      if (d.closedBy === "owner") {
        closedByText = "dono do chat";
      } else if (d.closedBy === "agent") {
        closedByText = "atendente";
      } else if (d.closedBy) {
        const [agent] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, d.closedBy))
          .limit(1);
        closedByText = agent?.name ?? "atendente";
      }

      await db.insert(whatsappMessages).values({
        conversationId: conversation.id,
        direction: "outbound",
        type: "system",
        content: `🤖 Atendimento encerrado pelo ${closedByText}`,
        status: "sent",
        sentAt: new Date(),
      });
      await updateSession(sessionId, {
        status: "completed",
        completedAt: new Date(),
        completionReason: "end_conversation",
      });
      break;
    }

    case "edit_tags": {
      const d = data as EditTagsNodeData;
      const conversation = await findBotConversation(phone, sessionId);
      if (conversation.clientId) {
        if (d.mode === "add") {
          await addContactTags(conversation.clientId, d.tagIds ?? []);
        } else {
          await removeContactTags(conversation.clientId, d.tagIds ?? []);
        }
      } else {
        console.warn("[BotEngine] edit_tags ignorado — conversa sem clientId vinculado");
      }
      const next = await getNextNode(botId, node.id);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "end": {
      await updateSession(sessionId, {
        status: "completed",
        completedAt: new Date(),
        completionReason: "end_of_flow",
      });
      break;
    }

    default: {
      console.error("[BotEngine] Tipo de nó não suportado:", node.type);
      await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "unsupported_node" });
      break;
    }
    }

    return lastMessageId;
  } catch (error) {
    if (error instanceof BotNodeExecutionError) throw error;
    const channelId = await botSessionChannelId(sessionId).catch(() => null);
    console.error("[BotEngine] Falha ao executar nó", {
      botId,
      sessionId,
      channelId,
      nodeId: node.id,
      nodeType: node.type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new BotNodeExecutionError(node.id, node.type, error);
  }
}

/**
 * Handle padrão do nó de Condição. O editor atual sempre grava "no_match";
 * nós muito antigos podem não ter defaultHandle — cair em "no_match" (o handle
 * que o editor renderiza) em vez do legado "default". Arestas antigas ligadas
 * ao handle "default" são cobertas pelo fallback de getNextConditionNode.
 */
export function conditionDefaultHandle(data: ConditionNodeData): string {
  return data.defaultHandle ?? "no_match";
}

/**
 * Próximo nó a partir de um nó de Condição, com fallback para arestas legadas:
 * se o handle resolvido não tem aresta e não é "match", tenta o handle antigo
 * "default" antes de desistir.
 */
async function getNextConditionNode(
  botId: string,
  node: WhatsappBotNode,
  handle: string,
): Promise<WhatsappBotNode | null> {
  let next = await getNextNode(botId, node.id, handle);
  if (!next && handle !== "match" && handle !== "default") {
    next = await getNextNode(botId, node.id, "default");
  }
  return next;
}

/**
 * O nó de Condição precisa pausar aguardando uma mensagem do contato?
 * Só quando alguma regra depende do texto recebido ("Mensagem contém") ou no
 * modelo legado (branches por keyword / classificação por IA). Regras apenas
 * de atributo (etiqueta, campo, canal, atendente…) avaliam na hora.
 */
export function conditionRulesNeedReply(data: ConditionNodeData): boolean {
  if (data.mode === "attribute") return false;
  if (data.rules && data.rules.length > 0) {
    return data.rules.some((r) => r.field === "message_contains");
  }
  // Modelo legado (branches/useAI): sempre depende da mensagem do contato.
  return true;
}

/**
 * Handle de roteamento da resposta a um nó "Enviar template": botão casado →
 * handle do botão; senão, com a saída "Respondeu" ligada, texto livre é
 * resposta válida (prioridade sobre "Resposta inválida"); senão, "Resposta
 * inválida" se ligada; senão null (mensagem ignorada).
 */
export function resolveTemplateReplyHandle(
  data: SendTemplateNodeData,
  matchedButtonHandle: string | null | undefined,
): string | null {
  return (
    matchedButtonHandle ??
    (data.repliedHandle ? "replied" : null) ??
    (data.invalidResponseHandle ? "invalid_response" : null)
  );
}

export async function resolveConditionHandle(
  node: WhatsappBotNode,
  messageText: string,
  ctx?: Partial<ConditionRuleContext>,
): Promise<string> {
  const data = node.data as ConditionNodeData;
  const text = messageText.toLowerCase().trim();

  // Grupo de condições estilo Umbler (editor atual): AND entre todas as
  // regras de `data.rules`. Quando presente, ignora `branches`/`useAI`
  // (modelo legado, não populado pelo editor atual).
  if (data.rules && data.rules.length > 0) {
    console.log(
      `[WaBot][Condition] resolveConditionHandle: avaliando data.rules=${JSON.stringify(data.rules)} messageText=${JSON.stringify(messageText)} temClient=${!!ctx?.client} tagIds=${JSON.stringify(Array.from(ctx?.tagIds ?? []))}`,
    );
    const matched = evaluateConditionRules(data.rules, {
      ...ctx,
      messageText,
      tagIds: ctx?.tagIds ?? new Set(),
    });
    const handle = matched ? "match" : conditionDefaultHandle(data);
    console.log(`[WaBot][Condition] resolveConditionHandle: matched=${matched} handle=${handle}`);
    return handle;
  }

  if (data.useAI && data.branches?.length) {
    try {
      const handle = await classifyMessageIntent(messageText, data.branches);
      if (handle) return handle;
    } catch (err) {
      console.error("[WaBot] Erro na classificação por IA, usando keywords:", err);
    }
  }

  for (const branch of data.branches ?? []) {
    for (const kw of branch.keywords ?? []) {
      if (text.includes(kw.toLowerCase().trim())) {
        return branch.handle;
      }
    }
  }
  return conditionDefaultHandle(data);
}

export type ConditionRuleContext = {
  messageText?: string;
  client?: Client;
  /**
   * Etiquetas do WhatsApp do contato (`contactTags.whatsappTagId`) — o único
   * espaço de IDs que o editor de bot oferece nas regras de etiqueta.
   */
  tagIds: Set<string | null>;
  conversation?: {
    id: string;
    assignedAgentId: string | null;
    channelId: number | null;
    sectorId: string | null;
    phone: string;
  };
  /** Variáveis da sessão do bot (sessionData) — campo "value". */
  sessionVariables?: Record<string, string>;
  /** O contato tem apenas a conversa atual? — campo "first_conversation". */
  isFirstConversation?: boolean;
  /** Conversa é de grupo (JID @g.us)? — campo "contact_is_group". */
  isGroup?: boolean;
  /** Snapshot de presença SSE (ver isUserOnline no sse-hub) — campos "agent"/"agent_online". */
  agentOnlineIds?: Set<string>;
  /** botIds de outras sessões ativas deste telefone — campo "parallel_bot". */
  parallelBotIds?: Set<string>;
  /** Canal da conversa vinculado a um atendente (whatsapp_channels.user_id)? */
  channelHasAttendant?: boolean;
};

function ruleSelectedValues(rule: ConditionRule): string[] {
  if (rule.values?.length) return rule.values.filter(Boolean);
  return rule.value ? [rule.value] : [];
}

const REGEX_PATTERN_MAX = 512;
const REGEX_INPUT_MAX = 10_000;

/**
 * Operadores de comparação de texto compartilhados pelos campos
 * "contact_field", "value" e pelo caminho legado (coluna de `clients` direto em
 * rule.field). Comparações são case-insensitive; regex usa o valor bruto com
 * flag "i", com limites de tamanho como proteção básica contra padrões caros.
 */
function evalStringOperator(
  operator: ConditionRule["operator"],
  rawFieldValue: string,
  rawTarget: string,
): boolean {
  const fieldVal = rawFieldValue.toLowerCase().trim();
  const target = rawTarget.toLowerCase().trim();
  switch (operator) {
    case "equals":
      return fieldVal === target;
    case "not_equals":
      return fieldVal !== target;
    case "contains":
      return target !== "" && fieldVal.includes(target);
    case "not_contains":
      return target === "" || !fieldVal.includes(target);
    case "starts_with":
      return target !== "" && fieldVal.startsWith(target);
    case "ends_with":
      return target !== "" && fieldVal.endsWith(target);
    case "exists":
      return fieldVal !== "";
    case "is_empty":
      return fieldVal === "";
    case "matches_regex": {
      if (!rawTarget || rawTarget.length > REGEX_PATTERN_MAX) return false;
      try {
        const re = new RegExp(rawTarget, "i");
        return re.test(rawFieldValue.slice(0, REGEX_INPUT_MAX));
      } catch {
        console.warn(`[WaBot][Condition] Regex inválida em regra de condição: ${rawTarget}`);
        return false;
      }
    }
    default:
      return false;
  }
}

function evalBooleanOperator(
  operator: ConditionRule["operator"],
  actual: boolean,
): boolean {
  if (operator === "is_true") return actual;
  if (operator === "is_false") return !actual;
  return false;
}

function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Avalia uma única `ConditionRule` contra o contexto disponível. Usada tanto
 * pelo grupo de condições estilo Umbler (`data.rules`, avaliação AND) quanto
 * pelos ramos legados (`branches[].rule`, modo "attribute").
 *
 * Cobre todos os campos e operadores que o editor atual oferece
 * (ConditionRuleRow em bot-editor.tsx). Dados que o campo exige e não estão no
 * ctx (ex.: regra de atendente sem `conversation`) avaliam como false — quem
 * monta o contexto completo é `loadConditionRuleContext`.
 */
export function evaluateConditionRule(
  rule: ConditionRule,
  ctx: ConditionRuleContext,
): boolean {
  const result = evaluateConditionRuleInner(rule, ctx);
  console.log(
    `[WaBot][Condition] evaluateConditionRule: field=${rule.field} operator=${rule.operator} value=${JSON.stringify(rule.values ?? rule.value)} subField=${rule.subField ?? "-"} → ${result}`,
  );
  return result;
}

function evaluateConditionRuleInner(
  rule: ConditionRule,
  ctx: ConditionRuleContext,
): boolean {
  switch (rule.field) {
    case "message_contains": {
      const text = (ctx.messageText ?? "").toLowerCase().trim();
      const keywords = ruleSelectedValues(rule);
      return keywords.some((kw) => text.includes(kw.toLowerCase().trim()));
    }

    case "tag": {
      const contactTagIds = new Set(
        Array.from(ctx.tagIds).filter((t): t is string => t != null),
      );
      const selected = ruleSelectedValues(rule);
      switch (rule.operator) {
        case "has":
        case "has_any":
          return selected.some((t) => contactTagIds.has(t));
        case "not_has":
        case "has_none":
          return !selected.some((t) => contactTagIds.has(t));
        case "has_all":
          return selected.length > 0 && selected.every((t) => contactTagIds.has(t));
        case "has_exactly":
          return selected.length > 0 && setEquals(contactTagIds, new Set(selected));
        case "not_has_exactly":
          return !(selected.length > 0 && setEquals(contactTagIds, new Set(selected)));
        default:
          return false;
      }
    }

    // "Ativo" = contato cadastrado (client vinculado) que não fez opt-out de
    // mensagens — `clients` não tem coluna própria de ativo/inativo.
    case "contact_active":
      return evalBooleanOperator(rule.operator, !!ctx.client && !ctx.client.whatsappOptOut);

    case "contact_is_group":
      return evalBooleanOperator(rule.operator, ctx.isGroup === true);

    case "first_conversation":
      return evalBooleanOperator(rule.operator, ctx.isFirstConversation === true);

    case "agent_online": {
      const agentId = ctx.conversation?.assignedAgentId ?? null;
      const online = agentId != null && (ctx.agentOnlineIds?.has(agentId) ?? false);
      return evalBooleanOperator(rule.operator, online);
    }

    case "sector": {
      if (!rule.value) return false;
      const sectorId = ctx.conversation?.sectorId ?? null;
      if (rule.operator === "equals") return sectorId === rule.value;
      if (rule.operator === "not_equals") return sectorId !== rule.value;
      return false;
    }

    case "channel": {
      const channelId =
        ctx.conversation?.channelId != null ? String(ctx.conversation.channelId) : null;
      const selected = ruleSelectedValues(rule);
      switch (rule.operator) {
        case "is_one_of":
          return channelId != null && selected.includes(channelId);
        case "is_none_of":
          return !(channelId != null && selected.includes(channelId));
        // "Atendendo" = canal da conversa vinculado a um atendente.
        case "is_attending":
          return ctx.channelHasAttendant === true;
        case "not_attending":
          return ctx.channelHasAttendant !== true;
        default:
          return false;
      }
    }

    case "agent": {
      const agentId = ctx.conversation?.assignedAgentId ?? null;
      const selected = ruleSelectedValues(rule);
      const online = agentId != null && (ctx.agentOnlineIds?.has(agentId) ?? false);
      switch (rule.operator) {
        case "is_one_of":
          return agentId != null && selected.includes(agentId);
        case "is_none_of":
          return !(agentId != null && selected.includes(agentId));
        case "no_agent":
          return agentId == null;
        // Sem atendente atribuído: is_online=false, not_online=true.
        case "is_online":
          return online;
        case "not_online":
          return !online;
        default:
          return false;
      }
    }

    case "value": {
      const v = ctx.sessionVariables?.[rule.subField ?? ""] ?? "";
      return evalStringOperator(rule.operator, v, rule.value ?? "");
    }

    case "parallel_bot": {
      // Com o índice único de 1 sessão ativa por telefone, uma sessão
      // "paralela" só existirá se/quando o encadeamento paralelo
      // (TriggerFlowNodeData.executeParallel) criar sessões simultâneas — hoje
      // isto avalia quase sempre false, mas a semântica fica correta para o
      // futuro. O operador é ignorado (a UI só define o filtro opcional por
      // bot específico em rule.value).
      const parallel = ctx.parallelBotIds ?? new Set<string>();
      return rule.value ? parallel.has(rule.value) : parallel.size > 0;
    }

    case "contact_field": {
      if (!rule.subField) return false;
      const raw = (ctx.client?.[rule.subField as keyof Client] ?? "") as unknown;
      return evalStringOperator(rule.operator, raw == null ? "" : String(raw), rule.value ?? "");
    }

    default: {
      // Retrocompat: regras antigas gravavam a coluna de `clients` direto em
      // rule.field (ContactFieldKey), sem o wrapper contact_field/subField.
      const raw = (ctx.client?.[rule.field as keyof Client] ?? "") as unknown;
      return evalStringOperator(rule.operator, raw == null ? "" : String(raw), rule.value ?? "");
    }
  }
}

/** AND entre todas as regras do grupo (modelo estilo Umbler, `data.rules`). Grupo vazio nunca casa. */
export function evaluateConditionRules(
  rules: ConditionRule[],
  ctx: ConditionRuleContext,
): boolean {
  if (rules.length === 0) return false;
  return rules.every((rule) => evaluateConditionRule(rule, ctx));
}

/**
 * Avalia a regra de um único ramo (modo "attribute" legado) contra um
 * contato já carregado. Extraída de `resolveAttributeHandle` para ser
 * testável sem banco.
 */
export function matchesConditionBranch(
  branch: ConditionBranch,
  client: Client | undefined,
  tagIds: Set<string | null>,
): boolean {
  if (!branch.rule) return false;
  return evaluateConditionRule(branch.rule, { client, tagIds });
}

/**
 * Escolhe o primeiro ramo cuja regra casa com o contato ("primeiro que casa
 * vence" — não há avaliação de grupo AND aqui). Retorna `null` quando nenhum
 * ramo casa; quem chama decide o fallback (`defaultHandle`).
 */
export function pickAttributeBranch(
  branches: ConditionBranch[],
  client: Client | undefined,
  tagIds: Set<string | null>,
): string | null {
  for (const branch of branches) {
    if (matchesConditionBranch(branch, client, tagIds)) return branch.handle;
  }
  return null;
}

/**
 * Resolve a ramificação de um nó de Condição no modo "attribute": avalia as
 * regras de cada ramo contra os atributos do contato (etiquetas e campos de
 * `clients`) e retorna o handle do primeiro ramo que casar, ou o padrão.
 */
export async function resolveAttributeHandle(
  node: WhatsappBotNode,
  clientId: string | null,
): Promise<string> {
  const data = node.data as ConditionNodeData;
  if (!clientId) return conditionDefaultHandle(data);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  // Etiquetas do WhatsApp (whatsappTagId) — o espaço de IDs do editor de bot.
  const tagRows = await db
    .select({ whatsappTagId: contactTags.whatsappTagId })
    .from(contactTags)
    .where(eq(contactTags.clientId, clientId));
  const tagIds = new Set<string | null>(
    tagRows.map((t) => t.whatsappTagId).filter((t): t is string => t != null),
  );

  if (data.rules && data.rules.length > 0) {
    return evaluateConditionRules(data.rules, { client, tagIds }) ? "match" : conditionDefaultHandle(data);
  }

  return pickAttributeBranch(data.branches ?? [], client, tagIds) ?? conditionDefaultHandle(data);
}

/**
 * Monta o `ConditionRuleContext` completo para avaliar `data.rules` de um nó
 * de Condição: conversa, contato e etiquetas do WhatsApp sempre; dados extras
 * (presença de atendentes, contagem de conversas, sessões paralelas, vínculo
 * do canal) apenas quando alguma regra usa o campo correspondente.
 */
export async function loadConditionRuleContext(params: {
  phone: string;
  sessionId?: string;
  session?: WhatsappBotSession | null;
  rules: ConditionRule[];
  messageText?: string;
}): Promise<ConditionRuleContext> {
  const fields = new Set(params.rules.map((r) => r.field));

  let session = params.session ?? null;
  if (!session && params.sessionId) {
    const [row] = await db
      .select()
      .from(whatsappBotSessions)
      .where(eq(whatsappBotSessions.id, params.sessionId))
      .limit(1);
    session = row ?? null;
  }

  const conversationRow = await findBotConversation(params.phone, params.sessionId);
  const conversation = {
    id: conversationRow.id,
    assignedAgentId: conversationRow.assignedAgentId ?? null,
    channelId: conversationRow.channelId ?? null,
    sectorId: conversationRow.sectorId ?? null,
    phone: conversationRow.phone,
  };

  let client: Client | undefined;
  let tagIds = new Set<string | null>();
  if (conversationRow.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, conversationRow.clientId))
      .limit(1);
    client = c ?? undefined;
    // Etiquetas do WhatsApp (whatsappTagId) — o espaço de IDs do editor de bot.
    const tagRows = await db
      .select({ whatsappTagId: contactTags.whatsappTagId })
      .from(contactTags)
      .where(eq(contactTags.clientId, conversationRow.clientId));
    tagIds = new Set(tagRows.map((t) => t.whatsappTagId).filter((t): t is string => t != null));
  }

  const ctx: ConditionRuleContext = {
    messageText: params.messageText,
    client,
    tagIds,
    conversation,
    sessionVariables: session?.sessionData ?? undefined,
    isGroup: isGroupJid(conversation.phone),
  };

  if (fields.has("first_conversation")) {
    const rows = conversationRow.clientId
      ? await db
          .select({ id: whatsappConversations.id })
          .from(whatsappConversations)
          .where(eq(whatsappConversations.clientId, conversationRow.clientId))
          .limit(2)
      : await db
          .select({ id: whatsappConversations.id })
          .from(whatsappConversations)
          .where(eq(whatsappConversations.phone, conversation.phone))
          .limit(2);
    ctx.isFirstConversation = rows.length <= 1;
  }

  if (fields.has("agent") || fields.has("agent_online")) {
    ctx.agentOnlineIds = getOnlineUserIds();
  }

  if (fields.has("parallel_bot")) {
    const activeSessions = await db
      .select({ id: whatsappBotSessions.id, botId: whatsappBotSessions.botId })
      .from(whatsappBotSessions)
      .where(
        and(
          eq(whatsappBotSessions.phoneNumber, toMetaWhatsAppId(params.phone)),
          eq(whatsappBotSessions.status, "active"),
        ),
      );
    const currentSessionId = session?.id ?? params.sessionId;
    ctx.parallelBotIds = new Set(
      activeSessions.filter((s) => s.id !== currentSessionId).map((s) => s.botId),
    );
  }

  const needsChannelAttendant = params.rules.some(
    (r) => r.field === "channel" && (r.operator === "is_attending" || r.operator === "not_attending"),
  );
  if (needsChannelAttendant) {
    if (conversation.channelId != null) {
      const [chan] = await db
        .select({ userId: whatsappChannels.userId })
        .from(whatsappChannels)
        .where(eq(whatsappChannels.id, conversation.channelId))
        .limit(1);
      // "Atendendo" = canal da conversa vinculado a um atendente (user_id).
      ctx.channelHasAttendant = chan?.userId != null;
    } else {
      ctx.channelHasAttendant = false;
    }
  }

  return ctx;
}

/**
 * Resolve a opção escolhida num nó de Menu. Prioriza o id do botão/linha
 * (interactive reply id === handle da opção); como fallback, casa o texto
 * clicado com o label da opção. Retorna o handle da opção ou null.
 */
export function resolveMenuHandle(
  node: WhatsappBotNode,
  messageText: string,
  replyId?: string | null,
): string | null {
  const data = node.data as MenuNodeData;
  const options = data.options ?? [];
  if (replyId) {
    const byId = options.find((o) => o.handle === replyId);
    if (byId) return byId.handle;
  }
  const text = messageText.toLowerCase().trim();
  const byLabel = options.find((o) => o.label.toLowerCase().trim() === text);
  return byLabel?.handle ?? null;
}

/**
 * Resolve (e persiste, se necessário) o canal pelo qual o bot deve responder ao
 * ser disparado manualmente. Chamado UMA VEZ em startBotSession — turnos
 * subsequentes leem o canal já persistido na conversa a cada envio (ver
 * resolveBotSendChannel), pois podem ocorrer em webhooks futuros que não passam
 * por startBotSession de novo.
 *
 * Ordem de resolução:
 *  1. channelId explícito (override manual do admin/gerente na UI) — resolve e
 *     persiste em whatsapp_conversations.channel_id.
 *  2. Canal já persistido na conversa — usado como está.
 *  3. Canal vinculado ao atendente que disparou o bot (whatsapp_channels.user_id)
 *     — resolve e persiste.
 *  4. Nenhum resolvido — retorna null; as integrações caem no canal Cloud API
 *     global (comportamento legado, último fallback).
 */
async function resolveBotTriggerChannel(
  conversationId: string,
  channelId?: number,
  triggeredByUserId?: string,
): Promise<ResolvedChannel | null> {
  const resolved = await resolveOutboundChannel(conversationId, channelId, triggeredByUserId);
  if (resolved) return resolved;
  if (!triggeredByUserId) return null;

  const attendantChannel = await resolveChannelByUserId(triggeredByUserId).catch(() => null);
  if (!attendantChannel) return null;

  await db
    .update(whatsappConversations)
    .set({ channelId: attendantChannel.id, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));

  return attendantChannel;
}

/**
 * clientId da conversa mais recente deste telefone, tolerante a variações de
 * formato (com/sem DDI 55, com/sem 9º dígito, pontuação) — a comparação exata
 * por `phone` deixava as variáveis do cliente vazias quando a conversa foi
 * gravada em outro formato.
 */
async function findConversationClientIdByPhone(
  phone: string,
): Promise<{ clientId: string | null } | undefined> {
  const variants = phoneVariants(phone);
  const canonical = canonicalPhone(phone);
  if (variants.length === 0 && !canonical) return undefined;
  const [row] = await db
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(
      or(
        canonical ? eq(whatsappConversations.phoneNormalized, canonical) : undefined,
        variants.length > 0 ? inArray(whatsappConversations.phone, variants) : undefined,
        sql`regexp_replace(${whatsappConversations.phone}, '[^0-9]', '', 'g') = ${canonical || phone.replace(/\D/g, "")}`,
      ),
    )
    .orderBy(desc(whatsappConversations.lastMessageAt))
    .limit(1);
  return row;
}

export async function startBotSession(
  botId: string,
  phone: string,
  startNodeId?: string,
  campaignId?: string,
  channelId?: number,
  triggeredByUserId?: string,
  context?: StartBotContext,
): Promise<{
  status: "started" | "already_active" | "no_start_node" | "opted_out";
  lastMessageId: string | null;
  /** Canal resolvido para o disparo — quem persiste mensagens depois (ex.: a
   * campanha) precisa dele para gravar na conversa do canal certo. */
  channelId?: number | null;
}> {
  let entryNode: WhatsappBotNode | null = null;

  const effectiveChannelId = context?.channelId ?? channelId;
  const effectiveCampaignId =
    context?.source === "external" || context?.source === "campaign"
      ? (context.campaignId ?? campaignId)
      : campaignId;
  const effectiveTriggeredByUserId =
    context?.source === "manual" ? context.triggeredByUserId : triggeredByUserId;

  if (startNodeId) {
    entryNode = await getNode(startNodeId);
    if (entryNode?.botId !== botId) entryNode = null;
    if (
      entryNode &&
      context?.source === "external" &&
      entryNode.type === "start_channel" &&
      !nodeAllowsExternalChannel(entryNode, context.channelId)
    ) {
      entryNode = null;
    }
  } else if (context?.source === "external") {
    const rows = await db
      .select()
      .from(whatsappBotNodes)
      .where(
        and(
          eq(whatsappBotNodes.botId, botId),
          eq(whatsappBotNodes.type, "start_channel"),
        ),
      );
    entryNode =
      rows.find((node) => nodeAllowsExternalChannel(node, context.channelId)) ?? null;
  } else if (context?.source === "campaign") {
    const [nodes, edges] = await Promise.all([
      db.select().from(whatsappBotNodes).where(eq(whatsappBotNodes.botId, botId)),
      db.select().from(whatsappBotEdges).where(eq(whatsappBotEdges.botId, botId)),
    ]);
    entryNode = selectCampaignEntryNode(nodes, edges);
  } else {
    const [found] = await db
      .select()
      .from(whatsappBotNodes)
      .where(
        and(
          eq(whatsappBotNodes.botId, botId),
          inArray(whatsappBotNodes.type, ["start_manual", "start"]),
        ),
      )
      .limit(1);
    entryNode = found ?? null;
  }

  if (!entryNode) return { status: "no_start_node", lastMessageId: null };

  const existingSession = await getActiveSession(phone);
  if (existingSession) return { status: "already_active", lastMessageId: null };

  const [bot] = await db
    .select({ name: whatsappBots.name })
    .from(whatsappBots)
    .where(
      and(
        eq(whatsappBots.id, botId),
        isNull(whatsappBots.deletedAt),
      ),
    )
    .limit(1);
  if (!bot) return { status: "no_start_node", lastMessageId: null };
  const botName = bot.name;

  // Injeta campos do cliente como variáveis iniciais da sessão
  const convRow = await findConversationClientIdByPhone(phone);
  let clientRow: Client | null = null;
  if (convRow?.clientId) {
    const [client] = await db.select().from(clients).where(eq(clients.id, convRow.clientId)).limit(1);
    clientRow = client ?? null;
  }

  if (clientRow?.whatsappOptOut) {
    return { status: "opted_out", lastMessageId: null };
  }

  const clientVars = buildClientVariables(clientRow, phone);

  // O SELECT em getActiveSession acima é só fast-path; quem garante a
  // exclusividade de fato é o índice único parcial wa_bot_sessions_active_phone_uidx
  // (uma sessão "active" por telefone). Se dois disparos concorrentes para o
  // mesmo contato chegarem aqui quase simultaneamente, o INSERT perdedor cai
  // no catch abaixo em vez de criar uma segunda sessão ativa.
  let newSession: WhatsappBotSession;
  try {
    [newSession] = await db
      .insert(whatsappBotSessions)
      .values({
        botId,
        phoneNumber: toMetaWhatsAppId(phone),
        currentNodeId: entryNode.id,
        status: "active",
        sessionData: clientVars,
        campaignId: effectiveCampaignId ?? null,
      })
      .returning();
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { status: "already_active", lastMessageId: null };
    }
    throw err;
  }

  // Registra no histórico da conversa que o bot foi iniciado
  let sessionChannelId: number | null = null;
  try {
    // Canal explícito do disparo (override do admin) escopa a busca da
    // conversa; sem ele, cai na conversa existente deste telefone.
    const conversation =
      context?.source === "manual"
        ? (
            await db
              .select()
              .from(whatsappConversations)
              .where(eq(whatsappConversations.id, context.conversationId))
              .limit(1)
          )[0]
        : await findOrCreateConversation(phone, effectiveChannelId ?? undefined);
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    // No disparo manual, a rota já validou a perspectiva da conversa. Resolver
    // diretamente pelo snapshot evita que diálogos internos sejam reduzidos ao
    // canal "dono" da linha canônica. Origens externas continuam usando a
    // resolução isolada da conversa contato + canal.
    const resolvedChannel =
      context?.source === "manual"
        ? await resolveChannelById(context.channelId).catch(() => null)
        : await resolveBotTriggerChannel(
            conversation.id,
            effectiveChannelId,
            effectiveTriggeredByUserId,
          );
    sessionChannelId = resolvedChannel?.id ?? null;
    if (effectiveChannelId != null && sessionChannelId !== effectiveChannelId) {
      throw new Error("BOT_CHANNEL_MISMATCH");
    }
    await updateSession(newSession.id, { channelId: sessionChannelId });
    await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      channelId: sessionChannelId,
      direction: "outbound",
      type: "system",
      content: `🤖 Chatbot "${botName}" iniciado`,
      status: "sent",
      sentAt: new Date(),
    });
    await db
      .update(whatsappConversations)
      .set({ status: "open", lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversation.id));
    publishConversationEvent(conversation.id, "new_message", { clientId: conversation.clientId ?? null });
  } catch (err) {
    console.error("[WaBot] Erro ao registrar início do bot:", err);
    await markSessionFailed(newSession.id, err);
    throw err;
  }

  try {
    const lastMessageId = await executeNode(entryNode, phone, newSession.id, botId, clientVars);
    return { status: "started", lastMessageId, channelId: sessionChannelId };
  } catch (err) {
    await markSessionFailed(newSession.id, err);
    throw err;
  }
}

/**
 * Chamado quando o webhook recebe uma resposta de WhatsApp Flow (nfm_reply).
 * Mapeia os campos do formulário para variáveis de sessão e avança o fluxo.
 */
export async function handleFlowResponse(
  phone: string,
  responseJson: Record<string, unknown>,
): Promise<void> {
  let sessionId: string | undefined;
  try {
    const session = await getActiveSession(phone);
    if (!session) return;
    sessionId = session.id;

    const currentNode = await getNode(session.currentNodeId);
    if (!currentNode || currentNode.type !== "flow_form") return;

    const variables: Record<string, string> = { ...(session.sessionData ?? {}) };

    // Mapear todos os campos da resposta do Flow para variáveis de sessão
    for (const [key, value] of Object.entries(responseJson)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        variables[key] = String(value);
      }
    }

    const next = await getNextNode(session.botId, currentNode.id);
    if (!next) {
      await updateSession(session.id, { status: "completed", completedAt: new Date(), sessionData: variables, completionReason: "end_of_flow" });
      return;
    }
    await updateSession(session.id, { sessionData: variables });
    await executeNode(next, phone, session.id, session.botId, variables);
  } catch (err) {
    console.error("[BotEngine] Erro ao processar resposta de Flow:", err);
    if (sessionId) await markSessionFailed(sessionId, err);
  }
}

export async function handleInboundBotMessage(params: {
  phone: string;
  messageText?: string | null;
  replyId?: string | null;
  channelId?: number | null;
  startsConversation: boolean;
}): Promise<void> {
  if (params.startsConversation && params.channelId != null) {
    const automaticBot = await getAutomaticBotForChannel(params.channelId);
    if (automaticBot) {
      const result = await startBotSession(
        automaticBot.botId,
        params.phone,
        automaticBot.startNodeId,
        undefined,
        params.channelId,
        undefined,
        {
          source: "external",
          channelId: params.channelId,
        },
      );
      // A mensagem que abriu/reabriu a conversa é o gatilho. Ela nunca deve ser
      // consumida como resposta do primeiro nó interativo criado nesta execução.
      if (result.status === "started") return;
      // Sessão já ativa (ex.: bot de campanha aguardando resposta a um template
      // que reabriu a conversa), opt-out ou bot sem nó de entrada: a mensagem
      // NÃO é gatilho de nada novo — deve avançar a sessão existente abaixo.
    }
  }

  if (params.messageText) {
    await handleIncomingMessage(
      params.phone,
      params.messageText,
      params.replyId,
    );
  }
}

export async function handleIncomingMessage(
  phone: string,
  messageText: string,
  replyId?: string | null,
): Promise<void> {
  let sessionId: string | undefined;
  try {
    const session = await getActiveSession(phone);
    sessionId = session?.id;
    console.log(
      `[WaBot][Condition] handleIncomingMessage: phone=${phone} sessão=${session?.id ?? "(nenhuma)"} currentNodeId=${session?.currentNodeId ?? "-"}`,
    );

    if (session) {
      const currentNode = await getNode(session.currentNodeId);
      console.log(`[WaBot][Condition] handleIncomingMessage: currentNode tipo=${currentNode?.type ?? "(não encontrado)"}`);
      if (!currentNode) return;

      const variables: Record<string, string> = { ...(session.sessionData ?? {}) };

      if (currentNode.type === "question") {
        const d = currentNode.data as QuestionNodeData;

        // Valida a resposta, se houver validação configurada. Se inválida,
        // reenvia a mensagem de erro (ou repete a pergunta) e mantém a sessão
        // no nó atual, sem avançar.
        if (!validateAnswer(messageText, d.validation)) {
          const errText = interpolate(
            d.validationErrorText || d.messageText || "Resposta inválida. Tente novamente.",
            variables,
          );
          const waId = await sendFreeText(phone, errText, sessionId);
          await persistBotMessage(phone, { waMessageId: waId, type: "text", content: errText, sessionId });
          return;
        }

        // Capturar variável se configurada
        if (d.captureVariable) {
          variables[d.captureVariable] = messageText;
        }

        const next = await getNextNode(session.botId, currentNode.id);
        if (!next) {
          await updateSession(session.id, {
            status: "completed",
            completedAt: new Date(),
            sessionData: variables,
            completionReason: "end_of_flow",
          });
          return;
        }
        await updateSession(session.id, { sessionData: variables });
        await executeNode(next, phone, session.id, session.botId, variables);
      } else if (currentNode.type === "send_template") {
        const d = currentNode.data as SendTemplateNodeData;
        const buttonHandles = d.buttonHandles ?? [];
        const byHandle = (id: string) => buttonHandles.find((b) => b.handle === id);
        const byLabel = (text: string) => buttonHandles.find((b) => b.label.toLowerCase().trim() === text.toLowerCase().trim());
        const matchedButton = (replyId ? byHandle(replyId) : undefined) ?? byLabel(messageText);

        const handle = resolveTemplateReplyHandle(d, matchedButton?.handle);

        if (handle) {
          await updateSession(session.id, {
            pendingMessageId: null,
            responseDeadlineAt: null,
          });
          const next = await getNextNode(session.botId, currentNode.id, handle);
          if (next) {
            await executeNode(next, phone, session.id, session.botId, variables);
          } else {
            await updateSession(session.id, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
          }
        } else {
          console.warn("[BotEngine] send_template: resposta não reconhecida e invalidResponseHandle desligado — mensagem ignorada");
        }
        return;
      } else if (currentNode.type === "condition") {
        const condData = currentNode.data as ConditionNodeData;
        console.log(
          `[WaBot][Condition] handleIncomingMessage: nó=${currentNode.id} messageText=${JSON.stringify(messageText)} rules=${JSON.stringify(condData.rules)} branches=${JSON.stringify(condData.branches)}`,
        );
        let ruleCtx: Partial<ConditionRuleContext> | undefined;
        if (condData.rules?.length) {
          ruleCtx = await loadConditionRuleContext({
            phone,
            sessionId: session.id,
            session,
            rules: condData.rules,
            messageText,
          });
          // As variáveis em memória são mais frescas que o sessionData persistido.
          ruleCtx.sessionVariables = variables;
        }
        const handle = await resolveConditionHandle(currentNode, messageText, ruleCtx);
        console.log(`[WaBot][Condition] handleIncomingMessage: handle resolvido=${handle}`);
        const next = await getNextConditionNode(session.botId, currentNode, handle);
        console.log(`[WaBot][Condition] handleIncomingMessage: próximo nó=${next?.id ?? "(nenhum — encerrando)"} tipo=${next?.type ?? "-"}`);
        if (next) {
          await executeNode(next, phone, session.id, session.botId, variables);
        } else {
          await updateSession(session.id, {
            status: "completed",
            completedAt: new Date(),
            completionReason: "end_of_flow",
          });
        }
      } else if (currentNode.type === "menu") {
        const d = currentNode.data as MenuNodeData;
        const handle = resolveMenuHandle(currentNode, messageText, replyId);
        if (!handle) {
          // Escolha não reconhecida: reenvia o menu para o contato tentar de novo.
          await executeNode(currentNode, phone, session.id, session.botId, variables);
          return;
        }
        // Exporta o label escolhido (e o índice) como variáveis, à la Umbler.
        if (d.captureVariable) {
          const idx = (d.options ?? []).findIndex((o) => o.handle === handle);
          const chosen = (d.options ?? [])[idx];
          variables[d.captureVariable] = chosen?.label ?? messageText;
          variables[`${d.captureVariable}_index`] = String(idx);
        }
        const next = await getNextNode(session.botId, currentNode.id, handle);
        if (next) {
          await updateSession(session.id, { sessionData: variables });
          await executeNode(next, phone, session.id, session.botId, variables);
        } else {
          await updateSession(session.id, {
            status: "completed",
            completedAt: new Date(),
            sessionData: variables,
            completionReason: "end_of_flow",
          });
        }
      }
      return;
    }

    // Sem sessão ativa: não há disparo automático. Bots são iniciados
    // manualmente (em uma conversa) ou por campanha de marketing via
    // startBotSession(). Mensagens recebidas apenas avançam sessões já ativas.
  } catch (err) {
    console.error("[BotEngine] Error handling message:", err);
    if (sessionId) await markSessionFailed(sessionId, err);
  }
}

/**
 * Marca como timed_out todas as sessões ativas sem atividade por SESSION_TIMEOUT_MINUTES.
 * Chamado pelo job periódico expire-bot-sessions.
 */
export async function expireInactiveSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MINUTES * 60 * 1000);
  const result = await db
    .update(whatsappBotSessions)
    .set({ status: "timed_out", completedAt: new Date(), completionReason: "timed_out" })
    .where(
      and(
        eq(whatsappBotSessions.status, "active"),
        lt(whatsappBotSessions.lastActivityAt, cutoff),
        // Não expira sessões pausadas por um nó de espera (Aguardar).
        isNull(whatsappBotSessions.resumeAt),
        // Não expira sessões aguardando resposta de template (prazo de 24h — processTemplateTimeouts cuida delas).
        isNull(whatsappBotSessions.responseDeadlineAt),
      ),
    )
    .returning({ id: whatsappBotSessions.id });
  return result.length;
}

/**
 * Retoma sessões pausadas por um nó de espera cujo `resumeAt` já chegou.
 * Chamado pelo job periódico resume-bot-sessions.
 */
export async function resumeWaitingSessions(): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(whatsappBotSessions)
    .where(
      and(
        eq(whatsappBotSessions.status, "active"),
        isNotNull(whatsappBotSessions.resumeAt),
        lte(whatsappBotSessions.resumeAt, now),
      ),
    );

  for (const session of due) {
    try {
      const node = await getNode(session.currentNodeId);
      // Limpa o resumeAt antes de avançar para evitar reprocessamento.
      await updateSession(session.id, { resumeAt: null });
      if (!node) continue;

      const variables = session.sessionData ?? {};
      const next = await getNextNode(session.botId, node.id);
      if (next) {
        await executeNode(next, session.phoneNumber, session.id, session.botId, variables);
      } else {
        await updateSession(session.id, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
      }
    } catch (err) {
      console.error("[BotEngine] Erro ao retomar sessão em espera:", err);
      await markSessionFailed(session.id, err);
    }
  }

  return due.length;
}

/**
 * Varre sessões ativas em nó send_template cujo responseDeadlineAt já expirou
 * e roteia para o handle "no_response". Chamado pelo job periódico.
 */
export async function processTemplateTimeouts(): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(whatsappBotSessions)
    .where(
      and(
        eq(whatsappBotSessions.status, "active"),
        isNotNull(whatsappBotSessions.responseDeadlineAt),
        lte(whatsappBotSessions.responseDeadlineAt, now),
      ),
    );

  for (const session of due) {
    try {
      const node = await getNode(session.currentNodeId);
      if (!node || node.type !== "send_template") continue;

      await updateSession(session.id, {
        pendingMessageId: null,
        responseDeadlineAt: null,
      });

      const next = await getNextNode(session.botId, node.id, "no_response");
      if (next) {
        await executeNode(next, session.phoneNumber, session.id, session.botId, session.sessionData ?? {});
      } else {
        await updateSession(session.id, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
      }
    } catch (err) {
      console.error("[BotEngine] Erro ao processar timeout de template:", err);
      await markSessionFailed(session.id, err);
    }
  }

  return due.length;
}

/**
 * Chamado pelo webhook quando uma mensagem de template falhou na entrega.
 * Roteia sessões que aguardavam essa mensagem para o handle "not_delivered".
 */
export async function handleTemplateDeliveryFailure(waMessageId: string): Promise<void> {
  const [session] = await db
    .select()
    .from(whatsappBotSessions)
    .where(
      and(
        eq(whatsappBotSessions.status, "active"),
        eq(whatsappBotSessions.pendingMessageId, waMessageId),
      ),
    )
    .limit(1);

  if (!session) return;

  const node = await getNode(session.currentNodeId);
  if (!node || node.type !== "send_template") return;

  await updateSession(session.id, {
    pendingMessageId: null,
    responseDeadlineAt: null,
  });

  const next = await getNextNode(session.botId, node.id, "not_delivered");
  if (next) {
    await executeNode(next, session.phoneNumber, session.id, session.botId, session.sessionData ?? {});
  } else {
    await updateSession(session.id, { status: "completed", completedAt: new Date(), completionReason: "delivery_failed" });
  }
}
