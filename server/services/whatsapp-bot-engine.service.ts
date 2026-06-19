import { db } from "server/db";
import { eq, and, or, desc, sql, lt } from "drizzle-orm";
import {
  whatsappBots,
  whatsappBotNodes,
  whatsappBotEdges,
  whatsappBotSessions,
  whatsappTemplates,
  whatsappConversations,
  whatsappMessages,
  whatsappMedia,
  type WhatsappBotNode,
  type WhatsappBotSession,
  type SendMessageNodeData,
  type QuestionNodeData,
  type ConditionNodeData,
  type ActionNodeData,
  type FlowFormNodeData,
  type BotNodeData,
} from "@shared/schema";
import { publishConversationEvent } from "../lib/sse-hub";
import { sendTextMessage, sendTemplateMessage, sendFlowMessage, sendMediaByUrl, uploadMedia, sendMediaMessage } from "../integrations/whatsapp";
import { r2 } from "../lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getActiveBots } from "./whatsapp-bot.service";
import { findOrCreateConversation } from "./whatsapp-conversations.service";
import { classifyMessageIntent, classifyBotTriggerIntent } from "../ai-helpers";

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
  const result = await sendTextMessage(phone, text);
  return (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
}

interface PersistBotMessageOptions {
  waMessageId: string | null;
  type?: "text" | "image" | "document";
  content?: string | null;
  caption?: string | null;
  media?: {
    storageKey: string;
    waMediaId?: string | null;
    mimeType?: string;
    filename?: string;
  };
}

async function persistBotMessage(
  phone: string,
  options: PersistBotMessageOptions,
): Promise<void> {
  try {
    const conversation = await findOrCreateConversation(phone);
    const msgType = options.type ?? "text";
    const [saved] = await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      waMessageId: options.waMessageId ?? undefined,
      direction: "outbound",
      type: msgType,
      content: msgType === "text" ? (options.content ?? null) : null,
      caption: msgType !== "text" ? (options.caption ?? null) : null,
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
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversation.id));

    if (conversation.clientId) {
      publishConversationEvent(conversation.clientId, "new_message", { clientId: conversation.clientId });
    }
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
        eq(whatsappBotSessions.phoneNumber, phone),
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

  let edge = edges.find(
    (e) => sourceHandle && e.sourceHandle === sourceHandle,
  );
  if (!edge) edge = edges[0];
  if (!edge) return null;

  return getNode(edge.targetNodeId);
}

async function updateSession(
  sessionId: string,
  data: {
    currentNodeId?: string;
    status?: "active" | "completed" | "timed_out";
    completedAt?: Date;
    sessionData?: Record<string, string>;
  },
): Promise<void> {
  await db
    .update(whatsappBotSessions)
    .set({ ...data, lastActivityAt: new Date() })
    .where(eq(whatsappBotSessions.id, sessionId));
}

function interpolate(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

async function executeNode(
  node: WhatsappBotNode,
  phone: string,
  sessionId: string,
  botId: string,
  variables: Record<string, string> = {},
): Promise<void> {
  const data = node.data as BotNodeData;

  switch (node.type) {
    case "start": {
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "send_message": {
      const d = data as SendMessageNodeData;
      if (d.messageType === "template") {
        try {
          if (d.metaTemplateName) {
            const interpolatedParams = (d.templateParams ?? []).map((component) => ({
              ...component,
              parameters: component.parameters.map((param) => ({
                ...param,
                text: interpolate(param.text, variables),
              })),
            }));
            const result = await sendTemplateMessage(
              phone,
              d.metaTemplateName,
              d.metaTemplateLanguage ?? "pt_BR",
              interpolatedParams,
            );
            const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
            await persistBotMessage(phone, { waMessageId: waId, type: "text", content: `Template: ${d.metaTemplateName}` });
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
              const result = await sendTemplateMessage(phone, tpl.name, tpl.languageCode, components);
              const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
              await persistBotMessage(phone, { waMessageId: waId, type: "text", content: `Template: ${tpl.name}` });
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
          const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";
          const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: d.attachment.storageKey }));
          if (!obj.Body) {
            throw new Error(`[BotEngine] Arquivo não encontrado no storage: ${d.attachment.storageKey}`);
          }
          const chunks: Buffer[] = [];
          for await (const chunk of obj.Body as NodeJS.ReadableStream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
          }
          const buffer = Buffer.concat(chunks);
          const mimeType = d.attachment.mimeType ?? (d.attachment.type === "image" ? "image/jpeg" : "application/octet-stream");
          const filename = d.attachment.name ?? d.attachment.storageKey.split("/").pop() ?? "file";
          const mediaId = await uploadMedia(buffer, filename, mimeType);
          const result = await sendMediaMessage(phone, mediaId, d.attachment.type, text, filename);
          const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
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
          // Se há texto E anexo, o texto virou legenda. Não enviar mensagem separada.
        } else if (text) {
          const waId = await sendFreeText(phone, text);
          await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text });
        }
      }
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "question": {
      const d = data as QuestionNodeData;
      if (d.messageText) {
        const text = interpolate(d.messageText, variables);
        const waId = await sendFreeText(phone, text);
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: text });
      }
      await updateSession(sessionId, { currentNodeId: node.id, sessionData: variables });
      break;
    }

    case "condition": {
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "flow_form": {
      const d = data as FlowFormNodeData;
      if (d.flowId) {
        const result = await sendFlowMessage(phone, d.flowId, d.ctaText || "Abrir formulário", {
          bodyText: d.bodyText,
          flowToken: d.flowToken,
        });
        const waId = (result?.messages as Array<{ id?: string }>)?.[0]?.id ?? null;
        await persistBotMessage(phone, { waMessageId: waId, type: "text", content: `[Formulário: ${d.flowName || d.flowId}]` });
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
        });
        return;
      }
      if (d.actionType === "assign_agent" && d.agentId) {
        const conversation = await findOrCreateConversation(phone);
        await db
          .update(whatsappConversations)
          .set({ assignedAgentId: d.agentId, updatedAt: new Date() })
          .where(eq(whatsappConversations.id, conversation.id));
      }
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId, variables);
      break;
    }

    case "end": {
      await updateSession(sessionId, {
        status: "completed",
        completedAt: new Date(),
      });
      break;
    }
  }
}

async function resolveConditionHandle(
  node: WhatsappBotNode,
  messageText: string,
): Promise<string> {
  const data = node.data as ConditionNodeData;
  const text = messageText.toLowerCase().trim();

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

export async function startBotSession(botId: string, phone: string): Promise<"started" | "already_active" | "no_start_node"> {
  const [startNode] = await db
    .select()
    .from(whatsappBotNodes)
    .where(
      and(
        eq(whatsappBotNodes.botId, botId),
        eq(whatsappBotNodes.type, "start"),
      ),
    )
    .limit(1);

  if (!startNode) return "no_start_node";

  const existingSession = await getActiveSession(phone);
  if (existingSession) return "already_active";

  const [bot] = await db.select({ name: whatsappBots.name }).from(whatsappBots).where(eq(whatsappBots.id, botId)).limit(1);
  const botName = bot?.name ?? "Bot";

  const [newSession] = await db
    .insert(whatsappBotSessions)
    .values({
      botId,
      phoneNumber: phone,
      currentNodeId: startNode.id,
      status: "active",
      sessionData: {},
    })
    .returning();

  // Registra no histórico da conversa que o bot foi iniciado
  try {
    const conversation = await findOrCreateConversation(phone);
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
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappConversations.id, conversation.id));
    if (conversation.clientId) {
      publishConversationEvent(conversation.clientId, "new_message", { clientId: conversation.clientId });
    }
  } catch (err) {
    console.error("[WaBot] Erro ao registrar início do bot:", err);
  }

  await executeNode(startNode, phone, newSession.id, botId, {});
  return "started";
}

/**
 * Chamado quando o webhook recebe uma resposta de WhatsApp Flow (nfm_reply).
 * Mapeia os campos do formulário para variáveis de sessão e avança o fluxo.
 */
export async function handleFlowResponse(
  phone: string,
  responseJson: Record<string, unknown>,
): Promise<void> {
  try {
    const session = await getActiveSession(phone);
    if (!session) return;

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
      await updateSession(session.id, { status: "completed", completedAt: new Date(), sessionData: variables });
      return;
    }
    await updateSession(session.id, { sessionData: variables });
    await executeNode(next, phone, session.id, session.botId, variables);
  } catch (err) {
    console.error("[BotEngine] Erro ao processar resposta de Flow:", err);
  }
}

export async function handleIncomingMessage(
  phone: string,
  messageText: string,
): Promise<void> {
  try {
    const session = await getActiveSession(phone);

    if (session) {
      const currentNode = await getNode(session.currentNodeId);
      if (!currentNode) return;

      const variables: Record<string, string> = { ...(session.sessionData ?? {}) };

      if (currentNode.type === "question") {
        const d = currentNode.data as QuestionNodeData;
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
          });
          return;
        }
        await updateSession(session.id, { sessionData: variables });
        await executeNode(next, phone, session.id, session.botId, variables);
      } else if (currentNode.type === "condition") {
        const handle = await resolveConditionHandle(currentNode, messageText);
        const next = await getNextNode(session.botId, currentNode.id, handle);
        if (next) {
          await executeNode(next, phone, session.id, session.botId, variables);
        } else {
          await updateSession(session.id, {
            status: "completed",
            completedAt: new Date(),
          });
        }
      }
      return;
    }

    // No active session — find a matching bot trigger
    const bots = await getActiveBots();

    // keyword bots first, then ai_intent, then new_conversation
    const sorted = [
      ...bots.filter((b) => b.triggerType === "keyword"),
      ...bots.filter((b) => b.triggerType === "ai_intent"),
      ...bots.filter((b) => b.triggerType === "new_conversation"),
    ];

    const text = messageText.toLowerCase().trim();

    let matchedBot = sorted.find((b) => {
      if (b.triggerType === "keyword") {
        const keywords: string[] = [
          ...(b.triggerKeywords ?? []),
          ...(b.triggerKeyword ? [b.triggerKeyword] : []),
        ];
        return keywords.some((kw) => kw && text.includes(kw.toLowerCase().trim()));
      }
      return false;
    });

    if (!matchedBot) {
      const aiIntentBots = sorted.filter((b) => b.triggerType === "ai_intent");
      if (aiIntentBots.length > 0) {
        for (const bot of aiIntentBots) {
          if (!bot.triggerPrompt) continue;
          try {
            const matched = await classifyBotTriggerIntent(messageText, bot.triggerPrompt);
            if (matched) {
              matchedBot = bot;
              break;
            }
          } catch {
            // Silently fallback — AI unavailable
          }
        }
      }
    }

    if (!matchedBot) {
      matchedBot = sorted.find((b) => b.triggerType === "new_conversation");
    }

    if (!matchedBot) return;

    const [startNode] = await db
      .select()
      .from(whatsappBotNodes)
      .where(
        and(
          eq(whatsappBotNodes.botId, matchedBot.id),
          eq(whatsappBotNodes.type, "start"),
        ),
      )
      .limit(1);

    if (!startNode) return;

    const [newSession] = await db
      .insert(whatsappBotSessions)
      .values({
        botId: matchedBot.id,
        phoneNumber: phone,
        currentNodeId: startNode.id,
        status: "active",
        sessionData: {},
      })
      .returning();

    await executeNode(startNode, phone, newSession.id, matchedBot.id, {});
  } catch (err) {
    console.error("[BotEngine] Error handling message:", err);
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
    .set({ status: "timed_out", completedAt: new Date() })
    .where(
      and(
        eq(whatsappBotSessions.status, "active"),
        lt(whatsappBotSessions.lastActivityAt, cutoff),
      ),
    )
    .returning({ id: whatsappBotSessions.id });
  return result.length;
}
