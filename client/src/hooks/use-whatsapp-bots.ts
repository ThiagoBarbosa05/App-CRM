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

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useWhatsappBots() {
  return useQuery<WhatsappBot[]>({
    queryKey: ["whatsapp", "bots"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/bots", {
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) throw new Error("Erro ao buscar bots");
      return res.json();
    },
  });
}

export function useWhatsappBotFlow(botId: string) {
  return useQuery<BotWithFlow>({
    queryKey: ["whatsapp", "bots", botId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/bots/${botId}`, {
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
      });
      if (!res.ok) throw new Error("Erro ao buscar bot");
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
      triggerType: "keyword" | "new_conversation";
      triggerKeyword?: string;
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
      if (!res.ok) throw new Error("Erro ao criar bot");
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
        triggerType: "keyword" | "new_conversation";
        triggerKeyword: string;
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
      if (!res.ok) throw new Error("Erro ao atualizar bot");
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
      if (!res.ok) throw new Error("Erro ao excluir bot");
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
      if (!res.ok) throw new Error("Erro ao salvar fluxo");
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
      if (!res.ok) throw new Error("Erro ao alterar status do bot");
      return res.json() as Promise<WhatsappBot>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "bots"] });
    },
  });
}
