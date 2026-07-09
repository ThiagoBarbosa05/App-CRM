import { Router } from "express";
import { z } from "zod";

const router = Router();

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
const ZERNIO_BASE = "https://zernio.com/api/v1";

function zernioHeaders() {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// GET /api/zernio/conversations
router.get("/conversations", async (req, res) => {
  try {
    if (!ZERNIO_API_KEY) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const { platform, cursor } = req.query;
    let url = `${ZERNIO_BASE}/inbox/conversations`;
    const params = new URLSearchParams();
    if (platform && platform !== "all") params.set("platform", String(platform));
    if (cursor) params.set("cursor", String(cursor));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    const resp = await fetch(url, { headers: zernioHeaders() });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/zernio/conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", async (req, res) => {
  try {
    if (!ZERNIO_API_KEY) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const { conversationId } = req.params;
    const { cursor } = req.query;
    let url = `${ZERNIO_BASE}/inbox/conversations/${conversationId}/messages`;
    if (cursor) url += `?cursor=${cursor}`;
    const resp = await fetch(url, { headers: zernioHeaders() });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// POST /api/zernio/conversations/:conversationId/messages
router.post("/conversations/:conversationId/messages", async (req, res) => {
  try {
    if (!ZERNIO_API_KEY) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const { conversationId } = req.params;
    const body = z.object({ accountId: z.string(), message: z.string().min(1) }).parse(req.body);
    const resp = await fetch(`${ZERNIO_BASE}/inbox/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: zernioHeaders(),
      body: JSON.stringify({ accountId: body.accountId, message: body.message }),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});

// GET /api/zernio/accounts — lista contas conectadas
router.get("/accounts", async (req, res) => {
  try {
    if (!ZERNIO_API_KEY) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, { headers: zernioHeaders() });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/zernio/status — verifica se a chave está configurada e válida
router.get("/status", async (req, res) => {
  if (!ZERNIO_API_KEY) return res.json({ configured: false });
  try {
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, { headers: zernioHeaders() });
    return res.json({ configured: true, ok: resp.ok, status: resp.status });
  } catch {
    return res.json({ configured: true, ok: false });
  }
});

// GET /api/zernio/events — SSE stream para mensagens recebidas em tempo real
router.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  import("../lib/zernio-sse").then(({ addZernioSseClient }) => {
    const cleanup = addZernioSseClient(res);
    req.on("close", cleanup);
  });
});

export default router;

// Webhook separado (sem autenticação JWT) para receber mensagens em tempo real
export const zernioWebhookRouter = Router();

// POST /api/zernio-webhook/message
zernioWebhookRouter.post("/message", (req, res) => {
  try {
    const event = req.body;
    if (!event || event.event !== "message.received") return res.json({ ok: true });
    // Emite o evento SSE para todos os clientes conectados ao inbox
    import("../lib/zernio-sse").then(({ publishZernioEvent }) => {
      publishZernioEvent(event.data);
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});
