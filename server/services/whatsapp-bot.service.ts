import { db } from "server/db";
import { eq, and } from "drizzle-orm";
import {
  whatsappBots,
  whatsappBotNodes,
  whatsappBotEdges,
  type WhatsappBot,
  type WhatsappBotNode,
  type WhatsappBotEdge,
  type InsertWhatsappBot,
  type InsertWhatsappBotNode,
  type InsertWhatsappBotEdge,
} from "@shared/schema";

export interface BotWithFlow {
  bot: WhatsappBot;
  nodes: WhatsappBotNode[];
  edges: WhatsappBotEdge[];
}

export async function listBots(): Promise<WhatsappBot[]> {
  return db.select().from(whatsappBots).orderBy(whatsappBots.createdAt);
}

export async function getBot(botId: string): Promise<BotWithFlow | null> {
  const [bot] = await db
    .select()
    .from(whatsappBots)
    .where(eq(whatsappBots.id, botId));
  if (!bot) return null;

  const nodes = await db
    .select()
    .from(whatsappBotNodes)
    .where(eq(whatsappBotNodes.botId, botId));

  const edges = await db
    .select()
    .from(whatsappBotEdges)
    .where(eq(whatsappBotEdges.botId, botId));

  return { bot, nodes, edges };
}

export async function createBot(data: InsertWhatsappBot): Promise<BotWithFlow> {
  const [bot] = await db.insert(whatsappBots).values(data).returning();

  const startNodeId = `start-${bot.id}`;
  await db.insert(whatsappBotNodes).values({
    id: startNodeId,
    botId: bot.id,
    type: "start",
    label: "Início",
    positionX: 250,
    positionY: 50,
    data: {},
  });

  const nodes = await db
    .select()
    .from(whatsappBotNodes)
    .where(eq(whatsappBotNodes.botId, bot.id));

  return { bot, nodes, edges: [] };
}

export async function updateBot(
  botId: string,
  data: Partial<InsertWhatsappBot>,
): Promise<WhatsappBot> {
  const [updated] = await db
    .update(whatsappBots)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(whatsappBots.id, botId))
    .returning();
  if (!updated) throw new Error("Bot not found");
  return updated;
}

export async function deleteBot(botId: string): Promise<void> {
  await db.delete(whatsappBots).where(eq(whatsappBots.id, botId));
}

export async function saveFlow(
  botId: string,
  nodes: InsertWhatsappBotNode[],
  edges: InsertWhatsappBotEdge[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(whatsappBotEdges)
      .where(eq(whatsappBotEdges.botId, botId));
    await tx
      .delete(whatsappBotNodes)
      .where(eq(whatsappBotNodes.botId, botId));

    if (nodes.length > 0) {
      await tx.insert(whatsappBotNodes).values(nodes);
    }
    if (edges.length > 0) {
      await tx.insert(whatsappBotEdges).values(edges);
    }
  });
}

export async function getActiveBots(): Promise<WhatsappBot[]> {
  return db
    .select()
    .from(whatsappBots)
    .where(eq(whatsappBots.isActive, true))
    .orderBy(whatsappBots.createdAt);
}
