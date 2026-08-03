import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  whatsappBotEdges,
  whatsappBotNodes,
  whatsappBots,
  whatsappChannels,
  type WhatsappBotEdge,
  type WhatsappBotNode,
} from "@shared/schema";
import { selectCampaignEntryNode } from "./whatsapp-bot-engine.service";
import { resolveChannelById, type ResolvedChannel } from "./whatsapp-channels.service";

export type BotCompatibilityIssue = {
  nodeId: string;
  code:
    | "AMBIGUOUS_BRANCH"
    | "CLOUD_ONLY_NODE"
    | "CLOUD_WINDOW_REQUIRED"
    | "NO_CAMPAIGN_ENTRY";
  message: string;
};

export type BotCompatibilityResult = {
  compatible: boolean;
  provider: ResolvedChannel["provider"];
  issues: BotCompatibilityIssue[];
};

export class BotCompatibilityLookupError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = "BotCompatibilityLookupError";
  }
}

type TraversalState = { nodeId: string; customerWindowOpen: boolean };

function isCloudOnlyNode(node: WhatsappBotNode): boolean {
  if (node.type === "send_template" || node.type === "menu" || node.type === "flow_form") {
    return true;
  }
  if (node.type !== "send_message") return false;
  return (node.data as { messageType?: string }).messageType === "template";
}

function requiresCloudCustomerWindow(node: WhatsappBotNode): boolean {
  if (node.type === "question" || node.type === "menu" || node.type === "flow_form") {
    return true;
  }
  if (node.type !== "send_message") return false;
  return (node.data as { messageType?: string }).messageType !== "template";
}

function nextWindowState(
  node: WhatsappBotNode,
  edge: WhatsappBotEdge,
  current: boolean,
): boolean {
  if (node.type === "question" || node.type === "menu" || node.type === "flow_form") {
    return true;
  }
  if (node.type === "condition") {
    const mode = (node.data as { mode?: string }).mode ?? "reply";
    return mode === "reply" ? true : current;
  }
  if (node.type === "send_template") {
    return edge.sourceHandle !== "no_response" && edge.sourceHandle !== "not_delivered";
  }
  return current;
}

export function analyzeBotFlowCompatibility(
  nodes: WhatsappBotNode[],
  edges: WhatsappBotEdge[],
  provider: ResolvedChannel["provider"],
): BotCompatibilityIssue[] {
  const entry = selectCampaignEntryNode(nodes, edges);
  if (!entry) {
    return [{
      nodeId: "",
      code: "NO_CAMPAIGN_ENTRY",
      message: "O bot não possui um nó inicial disponível para campanhas.",
    }];
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgesBySource = new Map<string, WhatsappBotEdge[]>();
  for (const edge of edges) {
    const current = edgesBySource.get(edge.sourceNodeId) ?? [];
    current.push(edge);
    edgesBySource.set(edge.sourceNodeId, current);
  }

  const issues: BotCompatibilityIssue[] = [];
  const issueKeys = new Set<string>();
  const addIssue = (issue: BotCompatibilityIssue): void => {
    const key = `${issue.nodeId}:${issue.code}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push(issue);
  };

  const queue: TraversalState[] = [{ nodeId: entry.id, customerWindowOpen: false }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const state = queue.shift()!;
    const visitKey = `${state.nodeId}:${state.customerWindowOpen ? "open" : "closed"}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const node = nodesById.get(state.nodeId);
    if (!node) continue;
    const outgoing = edgesBySource.get(node.id) ?? [];
    const defaultEdges = outgoing.filter((edge) => !edge.sourceHandle);
    if (defaultEdges.length > 1) {
      addIssue({
        nodeId: node.id,
        code: "AMBIGUOUS_BRANCH",
        message: `O nó "${node.label}" possui mais de uma saída sem condição definida.`,
      });
    }

    if (provider === "evolution" && isCloudOnlyNode(node)) {
      addIssue({
        nodeId: node.id,
        code: "CLOUD_ONLY_NODE",
        message: `O nó "${node.label}" usa um recurso exclusivo da Cloud API.`,
      });
    }
    if (
      provider === "cloud_api" &&
      !state.customerWindowOpen &&
      requiresCloudCustomerWindow(node)
    ) {
      addIssue({
        nodeId: node.id,
        code: "CLOUD_WINDOW_REQUIRED",
        message: `O nó "${node.label}" pode enviar conteúdo livre antes de o contato abrir a janela de 24 horas. Inicie o fluxo com um template que aguarde resposta.`,
      });
    }

    for (const edge of outgoing) {
      queue.push({
        nodeId: edge.targetNodeId,
        customerWindowOpen: nextWindowState(
          node,
          edge,
          state.customerWindowOpen,
        ),
      });
    }
  }

  return issues;
}

export async function analyzeBotCompatibility(
  botId: string,
  channelId: number,
): Promise<BotCompatibilityResult> {
  const [[bot], [channelRow], nodes, edges] = await Promise.all([
    db
      .select({ id: whatsappBots.id })
      .from(whatsappBots)
      .where(and(eq(whatsappBots.id, botId), isNull(whatsappBots.deletedAt)))
      .limit(1),
    db
      .select({ id: whatsappChannels.id, connectionStatus: whatsappChannels.connectionStatus })
      .from(whatsappChannels)
      .where(
        and(
          eq(whatsappChannels.id, channelId),
          eq(whatsappChannels.isActive, true),
          isNull(whatsappChannels.deletedAt),
        ),
      )
      .limit(1),
    db.select().from(whatsappBotNodes).where(eq(whatsappBotNodes.botId, botId)),
    db.select().from(whatsappBotEdges).where(eq(whatsappBotEdges.botId, botId)),
  ]);

  if (!bot) throw new BotCompatibilityLookupError("Bot não encontrado", 404);
  if (!channelRow) {
    throw new BotCompatibilityLookupError("Canal não encontrado ou inativo", 404);
  }
  const channel = await resolveChannelById(channelId);
  if (!channel) {
    throw new BotCompatibilityLookupError("Canal sem configuração de envio", 409);
  }
  if (channel.provider === "evolution" && channelRow.connectionStatus !== "connected") {
    throw new BotCompatibilityLookupError("Canal QR Code desconectado", 409);
  }

  const issues = analyzeBotFlowCompatibility(nodes, edges, channel.provider);
  return { compatible: issues.length === 0, provider: channel.provider, issues };
}
