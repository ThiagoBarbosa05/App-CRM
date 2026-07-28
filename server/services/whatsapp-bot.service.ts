import { randomUUID } from "crypto";
import { db } from "server/db";
import { eq, and, ilike, inArray, isNull, ne } from "drizzle-orm";
import {
  whatsappBots,
  whatsappBotNodes,
  whatsappBotEdges,
  whatsappBotSessions,
  whatsappChannels,
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

export class BotFlowValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 409 = 400,
  ) {
    super(message);
    this.name = "BotFlowValidationError";
  }
}

function isEntryNodeType(type: string): boolean {
  return type === "start" || type === "start_manual" || type === "start_channel";
}

function channelIdsFromNode(node: { type: string; data: unknown }): number[] {
  if (node.type !== "start_channel") return [];
  const channelIds = (node.data as { channelIds?: unknown }).channelIds;
  return Array.isArray(channelIds)
    ? channelIds.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
}

async function findAutomaticBotConflict(botId: string): Promise<string | null> {
  const rows = await db
    .select({
      botName: whatsappBots.name,
      data: whatsappBotNodes.data,
    })
    .from(whatsappBotNodes)
    .innerJoin(whatsappBots, eq(whatsappBots.id, whatsappBotNodes.botId))
    .where(
      and(
        eq(whatsappBotNodes.type, "start_channel"),
        eq(whatsappBots.isActive, true),
        isNull(whatsappBots.deletedAt),
        ne(whatsappBots.id, botId),
      ),
    );

  return rows.find((row) =>
    channelIdsFromNode({ type: "start_channel", data: row.data }).length > 0
  )?.botName ?? null;
}

export async function listBots(options?: {
  search?: string;
  activeOnly?: boolean;
  manualOnly?: boolean;
}): Promise<WhatsappBot[]> {
  const conditions = [isNull(whatsappBots.deletedAt)];
  if (options?.search) conditions.push(ilike(whatsappBots.name, `%${options.search}%`));
  if (options?.activeOnly) conditions.push(eq(whatsappBots.isActive, true));

  const query = db.select().from(whatsappBots).orderBy(whatsappBots.createdAt);
  let bots: WhatsappBot[];
  // Limita resultados só no modo "busca" (seletor de bot no composer) — a tela
  // de gerenciamento de bots continua listando tudo, sem paginação.
  if (options?.search || options?.activeOnly || options?.manualOnly) {
    bots = await query.where(and(...conditions)).limit(options?.manualOnly ? 100 : 30);
  } else {
    bots = await query.where(and(...conditions));
  }

  if (!options?.manualOnly || bots.length === 0) return bots;

  const manualNodes = await db
    .select({ botId: whatsappBotNodes.botId, data: whatsappBotNodes.data })
    .from(whatsappBotNodes)
    .where(
      and(
        inArray(whatsappBotNodes.botId, bots.map((bot) => bot.id)),
        inArray(whatsappBotNodes.type, ["start", "start_manual"]),
      ),
    );
  const listedBotIds = new Set(
    manualNodes
      .filter((node) => (node.data as { unlisted?: boolean }).unlisted !== true)
      .map((node) => node.botId),
  );
  return bots.filter((bot) => listedBotIds.has(bot.id)).slice(0, 30);
}

export async function getBot(botId: string): Promise<BotWithFlow | null> {
  const [bot] = await db
    .select()
    .from(whatsappBots)
    .where(
      and(
        eq(whatsappBots.id, botId),
        isNull(whatsappBots.deletedAt),
      ),
    );
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

  await db.insert(whatsappBotNodes).values([
    {
      id: `start-manual-${bot.id}`,
      botId: bot.id,
      type: "start_manual",
      label: "Iniciar manualmente",
      positionX: 120,
      positionY: 50,
      data: { unlisted: false },
    },
    {
      id: `start-channel-${bot.id}`,
      botId: bot.id,
      type: "start_channel",
      label: "Iniciar por um canal",
      positionX: 390,
      positionY: 50,
      data: { channelIds: [] },
    },
  ]);

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
  if (data.isActive === true) {
    const [automaticNode] = await db
      .select({ data: whatsappBotNodes.data })
      .from(whatsappBotNodes)
      .where(
        and(
          eq(whatsappBotNodes.botId, botId),
          eq(whatsappBotNodes.type, "start_channel"),
        ),
      )
      .limit(1);
    if (
      automaticNode &&
      channelIdsFromNode({ type: "start_channel", data: automaticNode.data }).length > 0
    ) {
      const conflictName = await findAutomaticBotConflict(botId);
      if (conflictName) {
        throw new BotFlowValidationError(
          `O bot "${conflictName}" já possui o início automático ativo.`,
          409,
        );
      }
    }
  }

  const [updated] = await db
    .update(whatsappBots)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(whatsappBots.id, botId),
        isNull(whatsappBots.deletedAt),
      ),
    )
    .returning();
  if (!updated) throw new Error("Bot not found");
  return updated;
}

export async function deleteBot(botId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [deleted] = await tx
      .update(whatsappBots)
      .set({
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(whatsappBots.id, botId),
          isNull(whatsappBots.deletedAt),
        ),
      )
      .returning({ id: whatsappBots.id });

    if (!deleted) return false;

    await tx
      .update(whatsappBotSessions)
      .set({
        status: "completed",
        completionReason: "bot_deleted",
        completedAt: now,
        lastActivityAt: now,
        resumeAt: null,
        pendingMessageId: null,
        responseDeadlineAt: null,
      })
      .where(
        and(
          eq(whatsappBotSessions.botId, botId),
          eq(whatsappBotSessions.status, "active"),
        ),
      );

    return true;
  });
}

export async function saveFlow(
  botId: string,
  nodes: InsertWhatsappBotNode[],
  edges: InsertWhatsappBotEdge[],
): Promise<void> {
  const [existingBot] = await db
    .select({ isActive: whatsappBots.isActive })
    .from(whatsappBots)
    .where(
      and(
        eq(whatsappBots.id, botId),
        isNull(whatsappBots.deletedAt),
      ),
    )
    .limit(1);
  if (!existingBot) {
    throw new BotFlowValidationError("Bot não encontrado.");
  }

  if (nodes.some((node) => node.botId !== botId) || edges.some((edge) => edge.botId !== botId)) {
    throw new BotFlowValidationError("Nós e conexões devem pertencer ao bot informado.");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) {
    throw new BotFlowValidationError("Existem nós duplicados no fluxo.");
  }
  if (edges.some((edge) => !nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId))) {
    throw new BotFlowValidationError("Existe uma conexão apontando para um nó inválido.");
  }

  const entryNodes = nodes.filter((node) => isEntryNodeType(node.type));
  if (entryNodes.length === 0) {
    throw new BotFlowValidationError("O fluxo precisa de pelo menos um nó de início.");
  }
  for (const entryNode of entryNodes) {
    if (!edges.some((edge) => edge.sourceNodeId === entryNode.id)) {
      throw new BotFlowValidationError(`O nó "${entryNode.label}" precisa estar conectado.`);
    }
  }

  const automaticNodes = nodes.filter((node) => node.type === "start_channel");
  if (automaticNodes.length > 1) {
    throw new BotFlowValidationError("O fluxo pode ter somente um início por canal.");
  }
  const manualNodes = nodes.filter(
    (node) => node.type === "start" || node.type === "start_manual",
  );
  if (manualNodes.length > 1) {
    throw new BotFlowValidationError("O fluxo pode ter somente um início manual.");
  }

  const automaticChannelIds = automaticNodes.flatMap((node) =>
    channelIdsFromNode({ type: node.type, data: node.data }),
  );
  if (automaticNodes.length > 0 && automaticChannelIds.length === 0) {
    throw new BotFlowValidationError("Selecione pelo menos um canal para o início automático.");
  }
  if (automaticChannelIds.length > 0) {
    const uniqueChannelIds = Array.from(new Set(automaticChannelIds));
    const activeChannels = await db
      .select({ id: whatsappChannels.id })
      .from(whatsappChannels)
      .where(
        and(
          inArray(whatsappChannels.id, uniqueChannelIds),
          eq(whatsappChannels.isActive, true),
        ),
      );
    if (activeChannels.length !== uniqueChannelIds.length) {
      throw new BotFlowValidationError("Um ou mais canais selecionados não existem ou estão inativos.");
    }

    if (existingBot.isActive) {
      const conflictName = await findAutomaticBotConflict(botId);
      if (conflictName) {
        throw new BotFlowValidationError(
          `O bot "${conflictName}" já possui o início automático ativo.`,
          409,
        );
      }
    }
  }

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
    .where(
      and(
        eq(whatsappBots.isActive, true),
        isNull(whatsappBots.deletedAt),
      ),
    )
    .orderBy(whatsappBots.createdAt);
}

export async function getAutomaticBotForChannel(
  channelId: number,
): Promise<{ botId: string; startNodeId: string } | null> {
  const rows = await db
    .select({
      botId: whatsappBots.id,
      startNodeId: whatsappBotNodes.id,
      data: whatsappBotNodes.data,
    })
    .from(whatsappBotNodes)
    .innerJoin(whatsappBots, eq(whatsappBots.id, whatsappBotNodes.botId))
    .where(
      and(
        eq(whatsappBotNodes.type, "start_channel"),
        eq(whatsappBots.isActive, true),
        isNull(whatsappBots.deletedAt),
      ),
    );

  return rows.find((row) =>
    channelIdsFromNode({ type: "start_channel", data: row.data }).includes(channelId)
  ) ?? null;
}

export async function duplicateBot(
  botId: string,
  userId: string,
): Promise<BotWithFlow> {
  const source = await getBot(botId);
  if (!source) throw new Error("Bot not found");

  const [bot] = await db
    .insert(whatsappBots)
    .values({
      name: `${source.bot.name} (cópia)`,
      description: source.bot.description,
      isActive: false,
      createdBy: userId,
    })
    .returning();

  // Remapeia IDs dos nós preservando a topologia das arestas.
  const idMap = new Map<string, string>();
  const newNodes: InsertWhatsappBotNode[] = source.nodes.map((n) => {
    const newId =
      n.type === "start" || n.type === "start_manual"
        ? `start-manual-${bot.id}`
        : n.type === "start_channel"
          ? `start-channel-${bot.id}`
          : randomUUID();
    idMap.set(n.id, newId);
    return {
      id: newId,
      botId: bot.id,
      type: n.type,
      label: n.label,
      positionX: n.positionX,
      positionY: n.positionY,
      data: n.data as InsertWhatsappBotNode["data"],
    };
  });

  const newEdges: InsertWhatsappBotEdge[] = source.edges
    .filter((e) => idMap.has(e.sourceNodeId) && idMap.has(e.targetNodeId))
    .map((e) => ({
      id: randomUUID(),
      botId: bot.id,
      sourceNodeId: idMap.get(e.sourceNodeId)!,
      targetNodeId: idMap.get(e.targetNodeId)!,
      sourceHandle: e.sourceHandle,
      label: e.label,
    }));

  await db.transaction(async (tx) => {
    if (newNodes.length > 0) await tx.insert(whatsappBotNodes).values(newNodes);
    if (newEdges.length > 0) await tx.insert(whatsappBotEdges).values(newEdges);
  });

  const nodes = await db
    .select()
    .from(whatsappBotNodes)
    .where(eq(whatsappBotNodes.botId, bot.id));
  const edges = await db
    .select()
    .from(whatsappBotEdges)
    .where(eq(whatsappBotEdges.botId, bot.id));

  return { bot, nodes, edges };
}
