import { Response } from "express";

type Client = { userId: string; res: Response };

const clients = new Set<Client>();

// Per-conversation (WhatsApp clientId) subscribers
const conversationClients = new Map<string, Set<Response>>();

export function addConversationSseClient(clientId: string, res: Response): () => void {
  if (!conversationClients.has(clientId)) conversationClients.set(clientId, new Set());
  conversationClients.get(clientId)!.add(res);
  res.write(`:ok\n\n`);
  const ping = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);
  return () => {
    clearInterval(ping);
    const set = conversationClients.get(clientId);
    if (set) {
      set.delete(res);
      if (set.size === 0) conversationClients.delete(clientId);
    }
  };
}

export function publishConversationEvent(clientId: string, event: string, data: unknown): void {
  const set = conversationClients.get(clientId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

export function addSseClient(userId: string, res: Response): () => void {
  const client: Client = { userId, res };
  clients.add(client);
  res.write(`:ok\n\n`);
  const ping = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);
  return () => {
    clearInterval(ping);
    clients.delete(client);
  };
}

/**
 * Envia evento SSE para um usuário específico (ou broadcast se userId omitido).
 * Falhas de write removem o cliente automaticamente.
 */
export function publishSseEvent(
  event: string,
  data: unknown,
  userId?: string,
): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (userId && c.userId !== userId) continue;
    try {
      c.res.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}
