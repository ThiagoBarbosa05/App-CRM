import { db } from "server/db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import {
  whatsappBots,
  whatsappBotNodes,
  whatsappBotEdges,
  whatsappBotSessions,
  whatsappTemplates,
  whatsappConversations,
  whatsappMessages,
  type WhatsappBotNode,
  type WhatsappBotSession,
  type SendMessageNodeData,
  type QuestionNodeData,
  type ConditionNodeData,
  type ActionNodeData,
  type BotNodeData,
} from "@shared/schema";
import { sendTextMessage, sendTemplateMessage } from "../integrations/whatsapp";
import { getActiveBots } from "./whatsapp-bot.service";

const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

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
async function sendFreeText(phone: string, text: string): Promise<void> {
  const windowOpen = await isWithinCustomerWindow(phone);
  if (!windowOpen) {
    throw new Error(
      "Janela de 24h fechada: a Meta não permite enviar texto livre para este contato. " +
        "Configure o primeiro nó do fluxo como um template aprovado.",
    );
  }
  await sendTextMessage(phone, text);
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
  },
): Promise<void> {
  await db
    .update(whatsappBotSessions)
    .set({ ...data, lastActivityAt: new Date() })
    .where(eq(whatsappBotSessions.id, sessionId));
}

async function executeNode(
  node: WhatsappBotNode,
  phone: string,
  sessionId: string,
  botId: string,
): Promise<void> {
  const data = node.data as BotNodeData;

  switch (node.type) {
    case "start": {
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId);
      break;
    }

    case "send_message": {
      const d = data as SendMessageNodeData;
      if (d.messageType === "template") {
        if (d.metaTemplateName) {
          await sendTemplateMessage(
            phone,
            d.metaTemplateName,
            d.metaTemplateLanguage ?? "pt_BR",
            (d.templateParams ?? []) as object[],
          );
        } else if (d.templateId) {
          const [tpl] = await db
            .select()
            .from(whatsappTemplates)
            .where(eq(whatsappTemplates.id, d.templateId))
            .limit(1);
          if (tpl) {
            await sendTemplateMessage(phone, tpl.name, tpl.languageCode, []);
          }
        }
      } else if (d.text) {
        await sendFreeText(phone, d.text);
      }
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId);
      break;
    }

    case "question": {
      const d = data as QuestionNodeData;
      if (d.messageText) {
        await sendFreeText(phone, d.messageText);
      }
      await updateSession(sessionId, { currentNodeId: node.id });
      break;
    }

    case "condition": {
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId);
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
      const next = await getNextNode(botId, node.id);
      if (next) await executeNode(next, phone, sessionId, botId);
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

  for (const branch of data.branches ?? []) {
    for (const kw of branch.keywords ?? []) {
      if (text.includes(kw.toLowerCase().trim())) {
        return branch.handle;
      }
    }
  }
  return data.defaultHandle ?? "default";
}

export async function startBotSession(botId: string, phone: string): Promise<void> {
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

  if (!startNode) return;

  const existingSession = await getActiveSession(phone);
  if (existingSession) return;

  const [newSession] = await db
    .insert(whatsappBotSessions)
    .values({
      botId,
      phoneNumber: phone,
      currentNodeId: startNode.id,
      status: "active",
    })
    .returning();

  await executeNode(startNode, phone, newSession.id, botId);
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

      if (currentNode.type === "question") {
        const next = await getNextNode(session.botId, currentNode.id);
        if (!next) {
          await updateSession(session.id, {
            status: "completed",
            completedAt: new Date(),
          });
          return;
        }
        await executeNode(next, phone, session.id, session.botId);
      } else if (currentNode.type === "condition") {
        const handle = await resolveConditionHandle(currentNode, messageText);
        const next = await getNextNode(session.botId, currentNode.id, handle);
        if (next) {
          await executeNode(next, phone, session.id, session.botId);
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

    // keyword bots first, then new_conversation bots
    const sorted = [
      ...bots.filter((b) => b.triggerType === "keyword"),
      ...bots.filter((b) => b.triggerType === "new_conversation"),
    ];

    const text = messageText.toLowerCase().trim();
    let matchedBot = sorted.find((b) => {
      if (b.triggerType === "keyword" && b.triggerKeyword) {
        return text.includes(b.triggerKeyword.toLowerCase().trim());
      }
      return false;
    });

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
      })
      .returning();

    await executeNode(startNode, phone, newSession.id, matchedBot.id);
  } catch (err) {
    console.error("[BotEngine] Error handling message:", err);
  }
}
