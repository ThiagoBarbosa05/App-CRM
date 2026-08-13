import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { dedupById, refreshFirstPage } from "@/lib/wa-chat-pagination";

export interface ClientWaMessageMedia {
  id: string;
  mimeType: string | null;
  filename: string | null;
}

export interface ClientWaMessage {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  content: string | null;
  caption: string | null;
  status: string | null;
  statusReason?: string | null;
  sentAt: string | null;
  createdAt: string;
  media: ClientWaMessageMedia | null;
}

interface ConversationCapabilities {
  provider: "cloud_api" | "evolution";
}

export interface WaChannel {
  id: number;
  name: string;
  displayPhone: string | null;
  connectionStatus: string | null;
  provider: string;
}

interface ConversationPage {
  messages: ClientWaMessage[];
  nextCursor: string | null;
  lastInboundAt: string | null;
  exists: boolean;
}

function conversationQueryKey(clientId: string) {
  return ["/api/whatsapp/conversations", clientId] as const;
}

async function fetchConversationPage(
  clientId: string,
  cursor: string | null,
): Promise<ConversationPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/whatsapp/conversations/${clientId}?${params}`);
  if (res.status === 404) {
    return { messages: [], nextCursor: null, lastInboundAt: null, exists: false };
  }
  if (!res.ok) throw new Error("Erro ao buscar conversa");
  const data = await res.json();
  return {
    messages: data?.messages ?? [],
    nextCursor: data?.nextCursor ?? null,
    lastInboundAt: data?.conversation?.lastInboundAt ?? null,
    exists: true,
  };
}

/**
 * Conversa de WhatsApp de um cliente específico, reaproveitando o mesmo
 * endpoint paginado por cursor que a inbox geral (`/api/whatsapp/conversations/:clientId`)
 * usa — `clientId` é resolvido para a conversa no backend.
 */
export function useClientConversation(clientId: string, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: conversationQueryKey(clientId),
    queryFn: ({ pageParam }) => fetchConversationPage(clientId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });

  const rawMessages = dedupById(
    query.data?.pages.slice().reverse().flatMap((p) => p.messages) ?? [],
  );
  const messages = [...rawMessages].sort(
    (a, b) =>
      new Date(a.sentAt ?? a.createdAt).getTime() - new Date(b.sentAt ?? b.createdAt).getTime(),
  );
  // A primeira página (cursor null) já diz se existe conversa; enquanto não
  // carregou nenhuma página ainda não dá pra afirmar que não existe.
  const conversationExists = query.data?.pages[0]?.exists ?? null;
  const lastInboundAt = query.data?.pages[0]?.lastInboundAt ?? null;

  return { ...query, messages, conversationExists, lastInboundAt };
}

export function useClientConversationCapabilities(clientId: string, enabled: boolean) {
  return useQuery<ConversationCapabilities | null>({
    queryKey: [...conversationQueryKey(clientId), "capabilities"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/conversations/${clientId}/capabilities`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
  });
}

/**
 * Canais de WhatsApp que o usuário logado pode usar para iniciar uma conversa —
 * mesmo endpoint que a inbox geral usa (`/api/whatsapp/channels/mine`): vendedor
 * só vê os canais aos quais tem acesso, admin/gerente veem todos os canais ativos.
 */
export function useAvailableWaChannels(enabled: boolean) {
  return useQuery<WaChannel[]>({
    queryKey: ["/api/whatsapp/channels/mine"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels/mine");
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
  });
}

/** Reabre/cria a conversa sob demanda — equivalente ao "Nova conversa" da inbox, com escolha de canal. */
export function useStartClientConversation(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (channelId?: number) => {
      const res = await apiRequest("POST", "/api/whatsapp/conversations/start", {
        clientId,
        channelId,
      });
      return res.json() as Promise<{ clientId: string | null; conversationId: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationQueryKey(clientId) });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSendClientMessage(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/conversations/${clientId}/messages`, {
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      refreshFirstPage(queryClient, conversationQueryKey(clientId), () =>
        fetchConversationPage(clientId, null),
      );
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSendClientMedia(clientId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (caption) form.append("caption", caption);
      const res = await fetch(`/api/whatsapp/conversations/${clientId}/messages/media`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Erro ao enviar arquivo");
      }
      return res.json();
    },
    onSuccess: () => {
      refreshFirstPage(queryClient, conversationQueryKey(clientId), () =>
        fetchConversationPage(clientId, null),
      );
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/** Assina o SSE por conversa (mesmo endpoint da inbox) e atualiza a página mais recente ao chegar evento. */
export function useClientConversationStream(clientId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !clientId) return;

    const es = new EventSource(`/api/whatsapp/conversations/${clientId}/stream`);
    const refresh = () => {
      refreshFirstPage(queryClient, conversationQueryKey(clientId), () =>
        fetchConversationPage(clientId, null),
      );
    };
    es.addEventListener("new_message", refresh);
    es.addEventListener("message_status", refresh);

    return () => es.close();
  }, [clientId, enabled, queryClient]);
}
