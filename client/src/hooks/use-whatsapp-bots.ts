import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  WhatsappBot,
  WhatsappBotNode,
  WhatsappBotEdge,
  BotNodeData,
} from "@shared/schema";

// ─── Frontend-specific types ──────────────────────────────────────────────────

export interface BotNodeFE {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: BotNodeData & { label: string };
}

export interface BotEdgeFE {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string | null;
}

export interface BotWithFlow {
  bot: WhatsappBot;
  nodes: WhatsappBotNode[];
  edges: WhatsappBotEdge[];
}

export interface BotCompatibilityIssue {
  nodeId: string;
  code:
    | "AMBIGUOUS_BRANCH"
    | "CLOUD_ONLY_NODE"
    | "CLOUD_WINDOW_REQUIRED"
    | "NO_CAMPAIGN_ENTRY";
  message: string;
}

export interface BotCompatibilityResult {
  compatible: boolean;
  provider: "cloud_api" | "evolution";
  issues: BotCompatibilityIssue[];
}

/**
 * Lança no mesmo formato de `apiRequest` (`"<status>: <corpo cru>"`), que é o
 * que `getWhatsappErrorPresentation` sabe ler — assim `code`/`hint` chegam
 * intactos até o toast. Estes hooks não usam `apiRequest` porque precisam do
 * header `x-user-id`, mas o formato do erro tem que ser o mesmo.
 */
async function throwBotApiError(res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(`${res.status}: ${body || res.statusText}`);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWhatsappBots() {
  return useQuery<WhatsappBot[]>({
    queryKey: ["whatsapp", "bots"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/bots", {
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) await throwBotApiError(res);
      return res.json();
    },
  });
}

export function useWhatsappBotCompatibility(
  botId: string,
  channelId: number | null,
) {
  return useQuery<BotCompatibilityResult>({
    queryKey: ["whatsapp", "bots", botId, "compatibility", channelId],
    queryFn: async () => {
      const res = await fetch(
        `/api/whatsapp/bots/${botId}/compatibility?channelId=${channelId}`,
        { headers: { "x-user-id": localStorage.getItem("userId") ?? "" } },
      );
      if (!res.ok) await throwBotApiError(res);
      return res.json() as Promise<BotCompatibilityResult>;
    },
    enabled: botId.length > 0 && channelId !== null,
    staleTime: 30_000,
  });
}

export function useWhatsappBotFlow(botId: string) {
  return useQuery<BotWithFlow>({
    queryKey: ["whatsapp", "bots", botId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/bots/${botId}`, {
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) await throwBotApiError(res);
      return res.json();
    },
    enabled: !!botId,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      isActive?: boolean;
    }) => {
      const res = await fetch("/api/whatsapp/bots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("userId") ?? "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwBotApiError(res);
      return res.json() as Promise<BotWithFlow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
    },
  });
}

export function useUpdateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      botId,
      data,
    }: {
      botId: string;
      data: Partial<{
        name: string;
        description: string | null;
        isActive: boolean;
      }>;
    }) => {
      const res = await fetch(`/api/whatsapp/bots/${botId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("userId") ?? "",
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) return throwBotApiError(res);
      return res.json() as Promise<WhatsappBot>;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
      queryClient.invalidateQueries({
        queryKey: ["whatsapp", "bots", vars.botId],
      });
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (botId: string) => {
      const res = await fetch(`/api/whatsapp/bots/${botId}`, {
        method: "DELETE",
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) return throwBotApiError(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
    },
  });
}

export function useDuplicateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (botId: string) => {
      const res = await fetch(`/api/whatsapp/bots/${botId}/duplicate`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) await throwBotApiError(res);
      return res.json() as Promise<BotWithFlow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
    },
  });
}

export function useSaveFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      botId,
      nodes,
      edges,
    }: {
      botId: string;
      nodes: {
        id: string;
        botId: string;
        type: string;
        label: string;
        positionX: number;
        positionY: number;
        data: Record<string, unknown>;
      }[];
      edges: {
        id: string;
        botId: string;
        sourceNodeId: string;
        targetNodeId: string;
        sourceHandle?: string | null;
        label?: string | null;
      }[];
    }) => {
      const res = await fetch(`/api/whatsapp/bots/${botId}/flow`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": localStorage.getItem("userId") ?? "",
        },
        body: JSON.stringify({ nodes, edges }),
      });
      if (!res.ok) return throwBotApiError(res);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["whatsapp", "bots", vars.botId],
      });
    },
  });
}

export function useToggleBotActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      botId,
      active,
    }: {
      botId: string;
      active: boolean;
    }) => {
      const action = active ? "activate" : "deactivate";
      const res = await fetch(`/api/whatsapp/bots/${botId}/${action}`, {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) return throwBotApiError(res);
      return res.json() as Promise<WhatsappBot>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
    },
  });
}
