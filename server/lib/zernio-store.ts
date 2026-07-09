// Armazenamento em memória para testes do inbox do Zernio.
// Não persiste em banco — dados somem ao reiniciar o servidor.

export interface ZernioStoredMessage {
  id: string;
  conversationId: string;
  direction: "incoming" | "outgoing";
  text?: string;
  timestamp: string;
  sender?: { id: string; name?: string };
}

export interface ZernioStoredConversation {
  id: string;
  platform: string;
  accountId: string;
  participant?: { id: string; name?: string; username?: string };
  lastMessage?: { text: string; timestamp: string; direction: "incoming" | "outgoing" };
  unreadCount: number;
}

const conversations = new Map<string, ZernioStoredConversation>();
const messagesByConversation = new Map<string, ZernioStoredMessage[]>();

export function upsertConversation(
  partial: Partial<Omit<ZernioStoredConversation, "id">> & { id: string },
): ZernioStoredConversation {
  const existing = conversations.get(partial.id);
  // Mescla campo a campo para não perder dados já conhecidos (ex.: nome do
  // participante) quando um evento subsequente vem com informação parcial.
  const participant =
    partial.participant || existing?.participant
      ? {
          id: partial.participant?.id ?? existing?.participant?.id ?? "",
          name: partial.participant?.name ?? existing?.participant?.name,
          username: partial.participant?.username ?? existing?.participant?.username,
        }
      : undefined;
  const merged: ZernioStoredConversation = {
    id: partial.id,
    platform: partial.platform ?? existing?.platform ?? "whatsapp",
    accountId: partial.accountId ?? existing?.accountId ?? "",
    participant,
    lastMessage: existing?.lastMessage,
    unreadCount: existing?.unreadCount ?? 0,
  };
  conversations.set(partial.id, merged);
  return merged;
}

/** Retorna `true` se a mensagem era nova (ignora reentregas do webhook com o mesmo id). */
export function addMessage(message: ZernioStoredMessage): boolean {
  const list = messagesByConversation.get(message.conversationId) ?? [];
  if (list.some((m) => m.id === message.id)) return false;
  list.push(message);
  messagesByConversation.set(message.conversationId, list);

  const conv = upsertConversation({ id: message.conversationId });
  conv.lastMessage = {
    text: message.text ?? "",
    timestamp: message.timestamp,
    direction: message.direction,
  };
  if (message.direction === "incoming") conv.unreadCount += 1;
  return true;
}

export function listConversations(platform?: string): ZernioStoredConversation[] {
  const all = Array.from(conversations.values());
  const filtered = platform && platform !== "all" ? all.filter((c) => c.platform === platform) : all;
  return filtered.sort((a, b) => {
    const at = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
    const bt = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
    return bt - at;
  });
}

export function listMessages(conversationId: string): ZernioStoredMessage[] {
  return (messagesByConversation.get(conversationId) ?? [])
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function markConversationRead(conversationId: string): void {
  const conv = conversations.get(conversationId);
  if (conv) conv.unreadCount = 0;
}
