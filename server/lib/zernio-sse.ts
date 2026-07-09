import { Response } from "express";

const clients = new Set<Response>();

export function addZernioSseClient(res: Response): () => void {
  clients.add(res);
  res.write(`:ok\n\n`);
  const ping = setInterval(() => {
    try { res.write(`:ping\n\n`); } catch { /* ignore */ }
  }, 25_000);
  return () => {
    clearInterval(ping);
    clients.delete(res);
  };
}

export function publishZernioEvent(data: unknown): void {
  const payload = `event: message.received\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}
