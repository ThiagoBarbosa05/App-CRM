import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { describe } from "vitest";

import { db } from "../db";
import {
  clients,
  contactTags,
  tags,
  users,
  whatsappBotEdges,
  whatsappBotNodes,
  whatsappBotSessions,
  whatsappBots,
  whatsappConversations,
  whatsappMessages,
  whatsappTags,
  whatsappTemplates,
  type BotNodeData,
  type WhatsappBotNode,
  type WhatsappBotSession,
} from "@shared/schema";

/**
 * Helpers de fixture para os testes e2e do engine do bot.
 *
 * Tudo aqui fala direto com o banco (sem importar serviços pesados como o
 * `whatsapp-conversations.service`, que arrastaria o Baileys). O engine, esse
 * sim, é importado pelo arquivo de teste — que mocka as fronteiras externas
 * (API do WhatsApp, Evolution, R2, SSE, IA).
 */

export const botE2EEnabled = Boolean(process.env.TEST_DATABASE_URL);

/**
 * `describe` que só roda quando `TEST_DATABASE_URL` está configurado. Sem banco
 * de teste, a suíte e2e é pulada (em vez de explodir ou — pior — tocar o banco
 * de desenvolvimento).
 */
export const describeBotE2E = describe.skipIf(!botE2EEnabled);

/** Tabelas zeradas entre os testes, na ordem segura (CASCADE cobre o resto). */
const TRUNCATE_TABLES = [
  "whatsapp_bot_sessions",
  "whatsapp_bot_edges",
  "whatsapp_bot_nodes",
  "whatsapp_bots",
  "whatsapp_media",
  "whatsapp_messages",
  "whatsapp_conversations",
  "contact_tags",
  "whatsapp_tags",
  "tags",
  "whatsapp_templates",
  "whatsapp_channels",
  "clients",
  "users",
].join(", ");

/**
 * Zera as tabelas usadas pelos testes. Guarda dupla: recusa rodar sem
 * `TEST_DATABASE_URL` para nunca truncar um banco real por engano.
 */
export async function resetBotTables(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "resetBotTables() exige TEST_DATABASE_URL — recusando truncar um banco não-teste.",
    );
  }
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${TRUNCATE_TABLES} RESTART IDENTITY CASCADE`),
  );
}

let userSeq = 0;

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  userSeq += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: overrides.name ?? `Test User ${userSeq}`,
      email: overrides.email ?? `user-${userSeq}-${randomUUID()}@test.local`,
      password: overrides.password ?? "hashed-test-password",
      role: overrides.role ?? "admin",
      ...overrides,
    })
    .returning();
  return user;
}

export async function createClient(
  overrides: Partial<typeof clients.$inferInsert> = {},
): Promise<typeof clients.$inferSelect> {
  const [client] = await db
    .insert(clients)
    .values({
      name: overrides.name ?? "Cliente Teste",
      categoria: overrides.categoria ?? "varejo",
      origem: overrides.origem ?? "teste",
      ...overrides,
    })
    .returning();
  return client;
}

export async function createTag(
  name: string,
  type: "marcador" | "origem" | "categoria" = "marcador",
): Promise<typeof tags.$inferSelect> {
  const [tag] = await db
    .insert(tags)
    .values({ name, type, color: "#000000" })
    .returning();
  return tag;
}

export async function attachTag(clientId: string, tagId: string): Promise<void> {
  await db.insert(contactTags).values({ clientId, tagId });
}

/** Etiqueta do WhatsApp (Umbler) — a que o nó "Editar etiquetas" do bot manipula de fato. */
export async function createWhatsappTag(
  name: string,
): Promise<typeof whatsappTags.$inferSelect> {
  const [tag] = await db
    .insert(whatsappTags)
    .values({ name, umblerTagId: randomUUID() })
    .returning();
  return tag;
}

export async function attachWhatsappTag(clientId: string, whatsappTagId: string): Promise<void> {
  await db.insert(contactTags).values({ clientId, whatsappTagId });
}

export async function createTemplate(
  createdBy: string,
  overrides: Partial<typeof whatsappTemplates.$inferInsert> = {},
): Promise<typeof whatsappTemplates.$inferSelect> {
  const [tpl] = await db
    .insert(whatsappTemplates)
    .values({
      name: overrides.name ?? "tpl_teste",
      languageCode: overrides.languageCode ?? "pt_BR",
      useCase: overrides.useCase ?? "custom",
      createdBy,
      ...overrides,
    })
    .returning();
  return tpl;
}

export async function createBot(
  createdBy: string,
  overrides: Partial<typeof whatsappBots.$inferInsert> = {},
): Promise<typeof whatsappBots.$inferSelect> {
  const [bot] = await db
    .insert(whatsappBots)
    .values({ name: overrides.name ?? "Bot Teste", createdBy, ...overrides })
    .returning();
  return bot;
}

export interface NodeSpec {
  /** id explícito (a coluna não tem default); gerado se omitido. */
  id?: string;
  type: WhatsappBotNode["type"];
  label?: string;
  data?: BotNodeData | Record<string, unknown>;
}

export async function addNode(
  botId: string,
  spec: NodeSpec,
): Promise<WhatsappBotNode> {
  const [node] = await db
    .insert(whatsappBotNodes)
    .values({
      id: spec.id ?? randomUUID(),
      botId,
      type: spec.type,
      label: spec.label ?? spec.type,
      data: (spec.data ?? {}) as Record<string, unknown>,
    })
    .returning();
  return node;
}

export async function addEdge(
  botId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle?: string,
): Promise<void> {
  await db.insert(whatsappBotEdges).values({
    id: randomUUID(),
    botId,
    sourceNodeId,
    targetNodeId,
    sourceHandle: sourceHandle ?? null,
  });
}

/**
 * Abre a janela de atendimento de 24h da Meta para um telefone: cria a conversa
 * (se preciso) e insere uma mensagem RECEBIDA recente. Sem isso, o engine recusa
 * enviar texto livre (`sendFreeText` lança "Janela de 24h fechada").
 */
export async function openCustomerWindow(
  phone: string,
  clientId?: string | null,
): Promise<{ conversationId: string }> {
  const [conversation] = await db
    .insert(whatsappConversations)
    .values({ phone, clientId: clientId ?? null })
    .returning();
  await db.insert(whatsappMessages).values({
    conversationId: conversation.id,
    direction: "inbound",
    type: "text",
    content: "olá",
    status: "read",
    sentAt: new Date(),
  });
  return { conversationId: conversation.id };
}

export async function getSession(
  phone: string,
): Promise<WhatsappBotSession | undefined> {
  const [session] = await db
    .select()
    .from(whatsappBotSessions)
    .where(eq(whatsappBotSessions.phoneNumber, phone))
    .orderBy(desc(whatsappBotSessions.startedAt))
    .limit(1);
  return session;
}

export async function getOutboundMessages(
  conversationId: string,
): Promise<Array<typeof whatsappMessages.$inferSelect>> {
  return db
    .select()
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.conversationId, conversationId),
        eq(whatsappMessages.direction, "outbound"),
      ),
    )
    .orderBy(whatsappMessages.createdAt);
}

export async function createConversation(
  overrides: Partial<typeof whatsappConversations.$inferInsert> = {},
): Promise<typeof whatsappConversations.$inferSelect> {
  const [conversation] = await db
    .insert(whatsappConversations)
    .values({
      phone: overrides.phone ?? `5511${Math.floor(Math.random() * 1e9)}`,
      ...overrides,
    })
    .returning();
  return conversation;
}

export async function createMessage(
  conversationId: string,
  overrides: Partial<typeof whatsappMessages.$inferInsert> = {},
): Promise<typeof whatsappMessages.$inferSelect> {
  const [message] = await db
    .insert(whatsappMessages)
    .values({
      conversationId,
      direction: overrides.direction ?? "inbound",
      type: overrides.type ?? "text",
      content: overrides.content ?? "mensagem de teste",
      sentAt: overrides.sentAt ?? new Date(),
      ...overrides,
    })
    .returning();
  return message;
}
