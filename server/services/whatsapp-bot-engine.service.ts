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
  users,
} from "@shared/schema";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { sendTextMessage, sendTemplateMessage, sendFlowMessage, sendMediaByUrl, uploadMedia, sendMediaMessage, sendButtonsMessage, sendListMessage } from "../integrations/whatsapp";
import type { ChannelOverride } from "../integrations/whatsapp";
import { sendText as evoSendText, sendMedia as evoSendMedia } from "../integrations/evolution";
import { toMetaWhatsAppId } from "@shared/phone";
import { getActiveChannelIdByUserId, resolveChannelByUserId, resolveChannelForConversation } from "./whatsapp-channels.service";
import type { ResolvedChannel } from "./whatsapp-channels.service";
import { r2, getPublicR2Url } from "../lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { findOrCreateConversation, resolveOutboundChannel, transferConversationToSector } from "./whatsapp-conversations.service";
import { listSectorIdsForUser } from "./whatsapp-sectors.service";
import { classifyMessageIntent } from "../ai-helpers";

const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;
const SESSION_TIMEOUT_MINUTES = 30;

/**
 * Verifica se o contato está dentro da janela de atendimento de 24h da Meta —
 * ou seja, se houve uma mensagem RECEBIDA dele nas últimas 24h. Fora dessa
 * janela a Meta só aceita templates aprovados, não texto livre.
 */
async function isWithinCustomerWindow(phone: string): Promise<boolean> {
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
        or(
          sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${digits}`,
          sql`regexp_replace(${whatsappConversations.phone}, '\\D', '', 'g') = ${withoutCountry}`,
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
 * Resolve (sem persistir) o canal ATUAL da conversa deste telefone, para decidir
 * por onde a próxima mensagem do bot deve sair. Chamado a cada envio dentro de
 * executeNode — não só no disparo inicial — pois uma sessão de bot segue em
 * turnos futuros (respostas do contato via webhook) que não passam de novo por
 * startBotSession/resolveBotTriggerChannel.
 */
async function resolveBotSendChannel(phone: string): Promise<ResolvedChannel | null> {
  const conversation = await findOrCreateConversation(phone);
  return resolveChannelForConversation(conversation.id).catch(() => null);
}

/**
 * Resolve o override Cloud API para recursos exclusivos da API oficial da Meta
 * (templates, botões/listas interativas, WhatsApp Flow) sem equivalente no
 * Evolution/Baileys. Se o canal resolvido da conversa for Evolution, lança um
 * erro claro em vez de cair silenciosamente no canal Cloud API global.
 */
async function resolveCloudOnlyChannel(phone: string, featureLabel: string): Promise<ChannelOverride | undefined> {
  const resolvedChannel = await resolveBotSendChannel(phone);
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
 * Cloud API: upload prévio (uploadMedia) + sendMediaMessage. Evolution: mídia
 * inline em base64 via sendMedia (sem upload prévio).
 */
async function sendBotMedia(
  phone: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  mediaType: "image" | "document",
  caption?: string,
): Promise<{ waMessageId: string | null; waMediaId: string | null }> {
  const resolvedChannel = await resolveBotSendChannel(phone);
  if (resolvedChannel?.provider === "evolution") {
    const base64 = buffer.toString("base64");
    const evoResult = await evoSendMedia(resolvedChannel.evolutionInstanceName, phone, mediaType, {
      base64: `data:${mimeType};base64,${base64}`,
      caption,
      filename,
      mimetype: mimeType,
    });
    return { waMessageId: evoResult?.key?.id ?? null, waMediaId: null };
  }
  const cloudOverride = resolvedChannel?.provider === "cloud_api"
    ? { phoneNumberId: resolvedChannel.phoneNumberId, accessToken: resolvedChannel.accessToken }
    : undefined;
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
async function sendFreeText(phone: string, text: string): Promise<string | null> {
  const windowOpen = await isWithinCustomerWindow(phone);
  if (!windowOpen) {
    throw new Error(
      "Janela de 24h fechada: a Meta não permite enviar texto livre para este contato. " +
        "Configure o primeiro nó do fluxo como um template aprovado.",
    );
  }
  const resolvedChannel = await resolveBotSendChannel(phone);
  if (resolvedChannel?.provider === "evolution") {
    const evoResult = await evoSendText(resolvedChannel.evolutionInstanceName, phone, text);
    return evoResult?.key?.id ?? null;
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
    const conversation = await findOrCreateConversation(phone);
    const msgType = options.type ?? "text";
    const hasContent = msgType === "text" || msgType === "template";
    const [saved] = await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
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

    publishConversationEvent(conversation.clientId ?? conversation.id, "new_message", { clientId: conversation.clientId ?? null });
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
  | "closed_by_agent";

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
  const vars: Record<string, string> = { telefone: phone };
  if (!client) return vars;
  if (client.name) vars.nome = client.name;
  if (client.email) vars.email = client.email;
  if (client.cpf) vars.cpf = client.cpf;
  if (client.birthday) vars.aniversario = client.birthday;
  if (client.city) vars.cidade = client.city;
  if (client.state) vars.estado = client.state;
  if (client.fixedPhone) vars.telefone_fixo = client.fixedPhone;
  if (client.address) vars.endereco = client.address;
  if (client.neighborhood) vars.bairro = client.neighborhood;
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

  switch (node.type) {
    case "start": {
      const next = await getNextNode(botId, node.id);
      if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "send_message": {
      const d = data as SendMessageNodeData;
      if (d.messageType === "template") {
        const cloudOverride = await resolveCloudOnlyChannel(phone, "templates");
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
              });
              lastMessageId = waId;
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
          const windowOpen = await isWithinCustomerWindow(phone);
          if (!windowOpen) {
            throw new Error(
              "Janela de 24h fechada: a Meta não permite enviar mídia para este contato sem template.",
            );
          }
          const buffer = await readR2Buffer(d.attachment.storageKey);
          const mimeType = d.attachment.mimeType ?? (d.attachment.type === "image" ? "image/jpeg" : "application/octet-stream");
          const filename = d.attachment.name ?? d.attachment.storageKey.split("/").pop() ?? "file";
          const { waMessageId: waId, waMediaId: mediaId } = await sendBotMedia(
            phone,
            buffer,
            filename,
            mimeType,
            d.attachment.type,
            text,
          );
          await persistBotMessage(phone, {
            waMessageId: waId,
            type: d.attachment.type,
            caption: text ?? null,
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
          const waId = await sendFreeText(phone, text);
          await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text });
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
        const waId = await sendFreeText(phone, text);
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text });
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
        const conversation = await findOrCreateConversation(phone);
        const handle = await resolveAttributeHandle(node, conversation.clientId);
        console.log(`[WaBot][Condition] modo attribute: clientId=${conversation.clientId} handle=${handle}`);
        const next = await getNextNode(botId, node.id, handle);
        console.log(`[WaBot][Condition] modo attribute: próximo nó=${next?.id ?? "(nenhum — encerrando)"}`);
        if (next) lastMessageId = await executeNode(next, phone, sessionId, botId, variables);
        else await updateSession(sessionId, { status: "completed", completedAt: new Date(), completionReason: "end_of_flow" });
        break;
      }
      // Modo "reply" (padrão): pausa e aguarda a resposta do contato; a
      // ramificação é resolvida em handleIncomingMessage quando a próxima
      // mensagem chega. Sem isso, a condição cairia no primeiro edge e o fluxo
      // seria reiniciado a cada resposta (reenviando o template).
      console.log(`[WaBot][Condition] modo reply: pausando no nó ${node.id}, aguardando resposta do contato`);
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "menu": {
      const d = data as MenuNodeData;
      const options = (d.options ?? []).filter((o) => o.label?.trim());
      if (options.length > 0) {
        const windowOpen = await isWithinCustomerWindow(phone);
        if (!windowOpen) {
          throw new Error(
            "Janela de 24h fechada: a Meta não permite enviar menus interativos para este contato sem template.",
          );
        }
        const body = interpolate(d.bodyText || "", variables) || "Escolha uma opção:";
        const useButtons =
          d.renderAs === "buttons" || (d.renderAs !== "list" && options.length <= 3);
        const opts = {
          headerText: d.headerText ? interpolate(d.headerText, variables) : undefined,
          footerText: d.footerText ? interpolate(d.footerText, variables) : undefined,
        };
        const cloudOverride = await resolveCloudOnlyChannel(phone, "menus interativos (botões/lista)");
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
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: body });
        lastMessageId = waId;
      }
      // Pausa aguardando a escolha do contato (resolvida em handleIncomingMessage).
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "flow_form": {
      const d = data as FlowFormNodeData;
      if (d.flowId) {
        const cloudOverride = await resolveCloudOnlyChannel(phone, "formulários (WhatsApp Flow)");
        const result = await sendFlowMessage(phone, d.flowId, d.ctaText || "Abrir formulário", {
          bodyText: d.bodyText,
          flowToken: d.flowToken,
        }, cloudOverride);
        const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: `[Formulário: ${d.flowName || d.flowId}]` });
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

      const conversation = await findOrCreateConversation(phone);
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
            publishConversationEvent(conversation.clientId ?? conversation.id, "new_message", {
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

      const cloudOverride = await resolveCloudOnlyChannel(phone, "templates");
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
        await startBotSession(d.targetBotId, phone, d.targetNodeId);
      }
      break;
    }

    case "transfer_agent": {
      // NOTA: d.onlyIfCurrentHasPermission é no-op — não há modelo de permissão no schema (limitação conhecida).
      const d = data as TransferAgentNodeData;
      const conversation = await findOrCreateConversation(phone);

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

      const agentId = resolveTransferAgent(d, {
        currentConversationAgentId: conversation.assignedAgentId ?? null,
        clientPreviousAgentId,
        attendantIds,
        rng: Math.random,
      });

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
      const conversation = await findOrCreateConversation(phone);

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
      const conversation = await findOrCreateConversation(phone);
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
      const conversation = await findOrCreateConversation(phone);
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
}

export async function resolveConditionHandle(
  node: WhatsappBotNode,
  messageText: string,
  ctx?: { client?: Client; tagIds?: Set<string | null> },
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
      messageText,
      client: ctx?.client,
      tagIds: ctx?.tagIds ?? new Set(),
    });
    const handle = matched ? "match" : (data.defaultHandle ?? "default");
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
  return data.defaultHandle ?? "default";
}

export type ConditionRuleContext = {
  messageText?: string;
  client?: Client;
  tagIds: Set<string | null>;
};

/**
 * Avalia uma única `ConditionRule` contra o contexto disponível (mensagem
 * recebida e/ou contato carregado). Usada tanto pelo grupo de condições estilo
 * Umbler (`data.rules`, avaliação AND) quanto pelos ramos legados
 * (`branches[].rule`, modo "attribute").
 *
 * Cobre apenas os operadores de fato implementados hoje: `contains` (campo
 * "message_contains", contra a mensagem recebida), `has`/`not_has` (campo
 * "tag") e `is_empty`/`equals`/`contains` (demais campos, contra `clients`).
 * Os demais operadores de `ConditionRuleOperator` existem no schema/UI mas
 * ainda não têm avaliação aqui — caem no `default: false`.
 */
export function evaluateConditionRule(
  rule: ConditionRule,
  ctx: ConditionRuleContext,
): boolean {
  let result: boolean;
  if (rule.field === "message_contains") {
    const text = (ctx.messageText ?? "").toLowerCase().trim();
    const keywords: string[] = rule.values?.length ? rule.values : rule.value ? [rule.value] : [];
    result = keywords.some((kw) => text.includes(kw.toLowerCase().trim()));
    console.log(
      `[WaBot][Condition] evaluateConditionRule: field=message_contains keywords=${JSON.stringify(keywords)} text=${JSON.stringify(text)} → ${result}`,
    );
    return result;
  }
  if (rule.field === "tag") {
    const has = rule.value ? ctx.tagIds.has(rule.value) : false;
    result = rule.operator === "not_has" ? !has : has;
    console.log(
      `[WaBot][Condition] evaluateConditionRule: field=tag operator=${rule.operator} value=${rule.value} tagIds=${JSON.stringify(Array.from(ctx.tagIds))} → ${result}`,
    );
    return result;
  }
  const raw = (ctx.client?.[rule.field as keyof Client] ?? "") as unknown;
  const fieldVal = (raw == null ? "" : String(raw)).toLowerCase().trim();
  const target = (rule.value ?? "").toLowerCase().trim();
  switch (rule.operator) {
    case "is_empty":
      result = fieldVal === "";
      break;
    case "equals":
      result = fieldVal === target;
      break;
    case "contains":
      result = target !== "" && fieldVal.includes(target);
      break;
    default:
      result = false;
  }
  console.log(
    `[WaBot][Condition] evaluateConditionRule: field=${rule.field} operator=${rule.operator} fieldVal=${JSON.stringify(fieldVal)} target=${JSON.stringify(target)} → ${result}`,
  );
  return result;
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
  if (!clientId) return data.defaultHandle ?? "default";

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const tagRows = await db
    .select({ tagId: contactTags.tagId })
    .from(contactTags)
    .where(eq(contactTags.clientId, clientId));
  const tagIds = new Set(tagRows.map((t) => t.tagId));

  if (data.rules && data.rules.length > 0) {
    return evaluateConditionRules(data.rules, { client, tagIds }) ? "match" : (data.defaultHandle ?? "default");
  }

  return pickAttributeBranch(data.branches ?? [], client, tagIds) ?? data.defaultHandle ?? "default";
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

export async function startBotSession(
  botId: string,
  phone: string,
  startNodeId?: string,
  campaignId?: string,
  channelId?: number,
  triggeredByUserId?: string,
): Promise<{
  status: "started" | "already_active" | "no_start_node" | "opted_out";
  lastMessageId: string | null;
}> {
  let entryNode: WhatsappBotNode | null = null;

  if (startNodeId) {
    entryNode = await getNode(startNodeId);
  } else {
    const [found] = await db
      .select()
      .from(whatsappBotNodes)
      .where(
        and(
          eq(whatsappBotNodes.botId, botId),
          eq(whatsappBotNodes.type, "start"),
        ),
      )
      .limit(1);
    entryNode = found ?? null;
  }

  if (!entryNode) return { status: "no_start_node", lastMessageId: null };

  const existingSession = await getActiveSession(phone);
  if (existingSession) return { status: "already_active", lastMessageId: null };

  const [bot] = await db.select({ name: whatsappBots.name }).from(whatsappBots).where(eq(whatsappBots.id, botId)).limit(1);
  const botName = bot?.name ?? "Bot";

  // Injeta campos do cliente como variáveis iniciais da sessão
  const [convRow] = await db
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .limit(1);
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
        campaignId: campaignId ?? null,
      })
      .returning();
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { status: "already_active", lastMessageId: null };
    }
    throw err;
  }

  // Registra no histórico da conversa que o bot foi iniciado
  try {
    const conversation = await findOrCreateConversation(phone);
    const resolvedChannel = await resolveBotTriggerChannel(conversation.id, channelId, triggeredByUserId);
    await updateSession(newSession.id, { channelId: resolvedChannel?.id ?? null });
    await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
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
    publishConversationEvent(conversation.clientId ?? conversation.id, "new_message", { clientId: conversation.clientId ?? null });
  } catch (err) {
    console.error("[WaBot] Erro ao registrar início do bot:", err);
  }

  try {
    const lastMessageId = await executeNode(entryNode, phone, newSession.id, botId, clientVars);
    return { status: "started", lastMessageId };
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
          const waId = await sendFreeText(phone, errText);
          await persistBotMessage(phone, { waMessageId: waId, type: "text", content: errText });
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

        const handle = matchedButton?.handle ?? (d.invalidResponseHandle ? "invalid_response" : null);

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
        let ruleCtx: { client?: Client; tagIds?: Set<string | null> } | undefined;
        if (condData.rules?.length) {
          const conversation = await findOrCreateConversation(phone);
          console.log(`[WaBot][Condition] handleIncomingMessage: conversation.clientId=${conversation.clientId}`);
          if (conversation.clientId) {
            const [ruleClient] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, conversation.clientId))
              .limit(1);
            const tagRows = await db
              .select({ tagId: contactTags.tagId })
              .from(contactTags)
              .where(eq(contactTags.clientId, conversation.clientId));
            ruleCtx = { client: ruleClient, tagIds: new Set(tagRows.map((t) => t.tagId)) };
            console.log(
              `[WaBot][Condition] handleIncomingMessage: client carregado=${!!ruleClient} tagIds=${JSON.stringify(Array.from(ruleCtx.tagIds!))}`,
            );
          }
        }
        const handle = await resolveConditionHandle(currentNode, messageText, ruleCtx);
        console.log(`[WaBot][Condition] handleIncomingMessage: handle resolvido=${handle}`);
        const next = await getNextNode(session.botId, currentNode.id, handle);
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
