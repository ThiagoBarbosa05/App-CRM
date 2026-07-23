import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

export type ChatTab = "all" | "attendants" | "groups";

export interface InternalConversationSummary {
  id: string;
  type: "dm" | "group";
  name: string | null;
  avatarUrl: string | null;
  otherUser: { id: string; name: string; email: string } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  myRole: "owner" | "admin" | "member";
}

export interface InternalMessageMedia {
  id: string;
  url: string;
  mimeType: string;
  fileName: string | null;
}

export interface InternalMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string | null;
  type: "text" | "image" | "file" | "system";
  replyToMessageId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  media: InternalMessageMedia[];
}

const conversationsKey = (tab: ChatTab, search: string) =>
  ["/api/internal-chat/conversations", { tab, search }] as const;

export function useInternalConversations(tab: ChatTab, search: string) {
  return useQuery<InternalConversationSummary[]>({
    queryKey: conversationsKey(tab, search),
    queryFn: async () => {
      const params = new URLSearchParams({ tab });
      if (search.trim()) params.set("search", search.trim());
      const res = await apiRequest("GET", `/api/internal-chat/conversations?${params}`);
      return res.json();
    },
  });
}

export function useInternalMessages(conversationId: string | null) {
  return useQuery<InternalMessage[]>({
    queryKey: ["/api/internal-chat/conversations", conversationId, "messages"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/internal-chat/conversations/${conversationId}/messages`,
      );
      return res.json();
    },
    enabled: !!conversationId && !conversationId.startsWith("pending:"),
  });
}

export function useStartDmConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/internal-chat/conversations/dm", { userId });
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; memberUserIds: string[] }) => {
      const res = await apiRequest("POST", "/api/internal-chat/conversations/groups", params);
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

export function useSendInternalMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      content?: string;
      replyToMessageId?: string;
      mediaKey?: string;
      mimeType?: string;
      fileName?: string;
      sizeBytes?: number;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/internal-chat/conversations/${conversationId}/messages`,
        params,
      );
      return res.json() as Promise<InternalMessage>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

export function useMarkInternalRead(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/internal-chat/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

export function useGroupMembers(conversationId: string | null, enabled: boolean) {
  return useQuery<
    { userId: string; role: "owner" | "admin" | "member"; name: string; email: string }[]
  >({
    queryKey: ["/api/internal-chat/conversations", conversationId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/internal-chat/conversations/${conversationId}/members`);
      return res.json();
    },
    enabled: enabled && !!conversationId,
  });
}

export function useAddGroupMembers(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      await apiRequest("POST", `/api/internal-chat/conversations/${conversationId}/members`, {
        userIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "members"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "messages"],
      });
    },
  });
}

export function useRemoveGroupMember(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(
        "DELETE",
        `/api/internal-chat/conversations/${conversationId}/members/${userId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "members"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

export function usePromoteGroupMember(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(
        "POST",
        `/api/internal-chat/conversations/${conversationId}/members/${userId}/promote`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "members"],
      });
    },
  });
}

export function useRenameGroup(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("PUT", `/api/internal-chat/conversations/${conversationId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    },
  });
}

/**
 * Notificações globais do chat interno (aba não aberta, ou outra conversa
 * ativa) — invalida a lista de conversas para atualizar badge/pré-visualização.
 * Segue o mesmo padrão de EventSource usado em whatsapp/conversations.tsx.
 */
export function useInternalChatNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/internal-chat/stream");
    es.addEventListener("internal_conversation_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chat/conversations"] });
    });
    return () => es.close();
  }, [queryClient]);
}

/** Assina eventos em tempo real da conversa aberta (nova mensagem, membros). */
export function useInternalConversationStream(conversationId: string | null) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!conversationId || conversationId.startsWith("pending:")) return;

    const es = new EventSource(`/api/internal-chat/conversations/${conversationId}/stream`);
    esRef.current = es;

    const refreshMessages = () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/internal-chat/conversations", conversationId, "messages"],
      });
    };
    es.addEventListener("internal_new_message", refreshMessages);
    es.addEventListener("internal_member_added", refreshMessages);
    es.addEventListener("internal_member_removed", refreshMessages);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [conversationId, queryClient]);
}
