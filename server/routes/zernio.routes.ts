import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  addMessage,
  listConversations,
  listMessages,
  markConversationRead,
  upsertConversation,
} from "../lib/zernio-store";

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
    const { platform } = req.query;
    const data = await listConversations(platform ? String(platform) : undefined);
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/zernio/conversations/:conversationId/messages
router.get("/conversations/:conversationId/messages", async (req, res) => {
  try {
    if (!ZERNIO_API_KEY) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const { conversationId } = req.params;
    await markConversationRead(conversationId);
    const data = await listMessages(conversationId);
    return res.json({ data });
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
    await upsertConversation({ id: conversationId, accountId: body.accountId });
    // Usa o messageId retornado pela API do Zernio (não um id gerado aqui) para que,
    // quando o webhook "message.sent" chegar depois para essa mesma mensagem, o
    // addMessage o deduplique pelo id em vez de criar uma segunda linha.
    const sentMessageId = data?.data?.messageId ?? data?.messageId ?? data?.id ?? crypto.randomUUID();
    const sentAt = data?.data?.sentAt ?? data?.sentAt;
    await addMessage({
      id: sentMessageId,
      conversationId,
      direction: "outgoing",
      text: body.message,
      timestamp: sentAt ?? new Date().toISOString(),
    });
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

const WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET;

function verifySignature(req: any): boolean {
  if (!WEBHOOK_SECRET) return true; // sem segredo configurado, aceita tudo (não recomendado em produção)
  // Zernio herda a infraestrutura de webhooks do produto "Late" e ainda envia
  // os headers com o prefixo legado X-Late-* em produção, apesar da doc atual
  // descrever X-Zernio-Signature.
  const signature =
    (req.headers["x-zernio-signature"] as string | undefined) ??
    (req.headers["x-late-signature"] as string | undefined);
  if (!signature) return false;
  const rawBody: Buffer | undefined = req.rawBody;
  if (!rawBody) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// POST /api/zernio-webhook/message
zernioWebhookRouter.post("/message", async (req, res) => {
  try {
    if (!verifySignature(req)) {
      console.warn("[zernio-webhook] assinatura inválida — headers recebidos:", {
        "x-zernio-signature": req.headers["x-zernio-signature"],
        "x-late-signature": req.headers["x-late-signature"],
        "x-late-event": req.headers["x-late-event"],
        "x-late-event-id": req.headers["x-late-event-id"],
      });
      return res.status(403).json({ message: "Assinatura inválida" });
    }
    const event = req.body;
    if (!event) return res.json({ ok: true });
    console.log("[zernio-webhook] payload recebido:", JSON.stringify(event));
    const payload = event.data ?? event;
    const rawMessage = payload.message ?? payload;
    const conversationMeta = payload.conversation ?? {};
    const sender = rawMessage.sender ?? {};
    const account = payload.account ?? {};

    if (rawMessage?.conversationId) {
      const direction: "incoming" | "outgoing" = rawMessage.direction === "outgoing" ? "outgoing" : "incoming";
      const hasAttachments = Array.isArray(rawMessage.attachments) && rawMessage.attachments.length > 0;
      const text = rawMessage.text ?? rawMessage.message ?? rawMessage.body ?? (hasAttachments ? "📎 Anexo" : "");
      const timestamp =
        rawMessage.sentAt ?? rawMessage.createdAt ?? rawMessage.timestamp ?? payload.timestamp ?? new Date().toISOString();

      await upsertConversation({
        id: rawMessage.conversationId,
        platform: rawMessage.platform ?? account.platform,
        accountId: account.id ?? account.accountId,
        participant: {
          id: conversationMeta.participantId ?? sender.id,
          name: conversationMeta.participantName ?? sender.name,
          username: conversationMeta.participantUsername ?? sender.username,
        },
      });

      const storedMessage = {
        id: rawMessage.id ?? payload.id ?? crypto.randomUUID(),
        conversationId: rawMessage.conversationId,
        direction,
        text,
        timestamp,
        sender: sender.id || sender.name ? { id: sender.id, name: sender.name } : undefined,
      };
      const isNew = await addMessage(storedMessage);

      // Emite o evento SSE já normalizado no formato que o inbox espera
      if (isNew) {
        import("../lib/zernio-sse").then(({ publishZernioEvent }) => {
          publishZernioEvent(storedMessage);
        });
      }
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});
