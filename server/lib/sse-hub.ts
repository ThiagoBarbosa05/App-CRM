import { Response } from "express";

type Client = { userId: string; res: Response };

const clients = new Set<Client>();

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
