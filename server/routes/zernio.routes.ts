import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  addMessage,
  getConversationsByClient,
  hasRecentOutgoingMessage,
  linkConversationToClient,
  listConversations,
  listMessages,
  markConversationRead,
  unlinkConversationFromClient,
  upsertConversation,
} from "../lib/zernio-store";
import { findClientMatch } from "../lib/zernio-client-match";
import { redactPii } from "../lib/log-redaction";
import { requireAdmin } from "../middleware/validation";
import {
  ZERNIO_KEYS,
  getZernioApiKey,
  getZernioConfigured,
  getZernioSettingsForClient,
  getZernioWebhookSecret,
  upsertZernioSetting,
} from "../services/zernio-settings.service";

const ZERNIO_FETCH_TIMEOUT_MS = 15_000;

const router = Router();

const ZERNIO_BASE = "https://zernio.com/api/v1";

async function zernioHeaders() {
  return {
    Authorization: `Bearer ${await getZernioApiKey()}`,
    "Content-Type": "application/json",
  };
}

// GET /api/zernio/conversations
router.get("/conversations", async (req, res) => {
  try {
    if (!(await getZernioApiKey())) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
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
    if (!(await getZernioApiKey())) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
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
    if (!(await getZernioApiKey())) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const { conversationId } = req.params;
    const body = z.object({ accountId: z.string(), message: z.string().min(1) }).parse(req.body);
    const resp = await fetch(`${ZERNIO_BASE}/inbox/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: await zernioHeaders(),
      body: JSON.stringify({ accountId: body.accountId, message: body.message }),
      signal: AbortSignal.timeout(ZERNIO_FETCH_TIMEOUT_MS),
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

// POST /api/zernio/conversations/:conversationId/link — vincula a conversa a um cliente do CRM
router.post("/conversations/:conversationId/link", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const body = z
      .object({ clientId: z.string().min(1), platform: z.string().optional(), accountId: z.string().optional() })
      .parse(req.body);
    await linkConversationToClient({
      conversationId,
      clientId: body.clientId,
      platform: body.platform ?? "",
      accountId: body.accountId ?? "",
      linkedByUserId: req.user?.userId,
    });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});

// DELETE /api/zernio/conversations/:conversationId/link — remove o vínculo
router.delete("/conversations/:conversationId/link", async (req, res) => {
  try {
    const { conversationId } = req.params;
    await unlinkConversationFromClient(conversationId);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
});

// GET /api/zernio/clients/:clientId/conversations — conversas vinculadas a um cliente do CRM
router.get("/clients/:clientId/conversations", async (req, res) => {
  try {
    const { clientId } = req.params;
    const data = await getConversationsByClient(clientId);
    return res.json({ data });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/zernio/accounts — lista contas conectadas
router.get("/accounts", async (req, res) => {
  try {
    if (!(await getZernioApiKey())) return res.status(503).json({ message: "ZERNIO_API_KEY não configurada" });
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: await zernioHeaders(),
      signal: AbortSignal.timeout(ZERNIO_FETCH_TIMEOUT_MS),
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(data);
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// GET /api/zernio/status — verifica se a chave está configurada e válida
router.get("/status", async (req, res) => {
  if (!(await getZernioConfigured())) return res.json({ configured: false });
  try {
    const resp = await fetch(`${ZERNIO_BASE}/accounts`, {
      headers: await zernioHeaders(),
      signal: AbortSignal.timeout(ZERNIO_FETCH_TIMEOUT_MS),
    });
    return res.json({ configured: true, ok: resp.ok, status: resp.status });
  } catch {
    return res.json({ configured: true, ok: false });
  }
});

// GET /api/zernio/settings — credenciais mascaradas (só admin)
router.get("/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await getZernioSettingsForClient();
    res.json(settings);
  } catch {
    res.status(500).json({ message: "Erro ao buscar configurações do Zernio" });
  }
});

// PUT /api/zernio/settings — salva API key / webhook secret (só admin)
router.put("/settings", requireAdmin, async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const updates: Array<{ key: string; value: string }> = [];

    for (const key of ZERNIO_KEYS) {
      const incoming = body[key];
      if (incoming === undefined || incoming === null) continue;
      updates.push({ key, value: String(incoming) });
    }

    if (updates.length === 0) {
      return res.json({ updated: 0 });
    }

    await Promise.all(updates.map(({ key, value }) => upsertZernioSetting(key, value)));
    res.json({ updated: updates.length });
  } catch {
    res.status(500).json({ message: "Erro ao salvar configurações do Zernio" });
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

async function verifySignature(req: any): Promise<boolean> {
  const webhookSecret = await getZernioWebhookSecret();
  if (!webhookSecret) {
    // Fail closed: sem segredo configurado, rejeita tudo. Em produção o webhook
    // só deve funcionar depois que ZERNIO_WEBHOOK_SECRET estiver definida — aceitar
    // tudo sem validar assinatura permitiria injetar mensagens falsas em conversas
    // de clientes reais.
    console.error("[zernio-webhook] webhook secret não configurado — rejeitando webhook");
    return false;
  }
  // Zernio herda a infraestrutura de webhooks do produto "Late" e ainda envia
  // os headers com o prefixo legado X-Late-* em produção, apesar da doc atual
  // descrever X-Zernio-Signature.
  const signature =
    (req.headers["x-zernio-signature"] as string | undefined) ??
    (req.headers["x-late-signature"] as string | undefined);
  if (!signature) return false;
  const rawBody: Buffer | undefined = req.rawBody;
  if (!rawBody) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// POST /api/zernio-webhook/message
zernioWebhookRouter.post("/message", async (req, res) => {
  try {
    if (!(await verifySignature(req))) {
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
    console.log("[zernio-webhook] payload recebido:", JSON.stringify(redactPii(event)));

    // O mesmo endpoint recebe todos os tipos de evento inscritos (message.received,
    // message.sent, message.delivered, message.read, message.failed, message.edited,
    // message.deleted, e eventos não relacionados a mensagens). Só message.received/
    // message.sent representam mensagens de chat novas — os demais têm payloads
    // parecidos (mesmo `conversationId`) mas não devem virar linhas em zernio_messages,
    // senão viram mensagens "fantasma" (ex: recibo de leitura registrado como incoming).
    const eventType: string | undefined = event.event ?? event.data?.event;
    if (eventType && eventType !== "message.received" && eventType !== "message.sent") {
      return res.json({ ok: true });
    }

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

      const conversation = await upsertConversation({
        id: rawMessage.conversationId,
        platform: rawMessage.platform ?? account.platform,
        accountId: account.id ?? account.accountId,
        participant: {
          id: conversationMeta.participantId ?? sender.id,
          name: conversationMeta.participantName ?? sender.name,
          username: conversationMeta.participantUsername ?? sender.username,
        },
      });

      // Identificação automática do cliente do CRM: só na primeira mensagem de uma
      // conversa nova (ainda sem vínculo manual) e só para mensagens realmente
      // recebidas do contato — usa telefone (WhatsApp) ou @usuário (Instagram),
      // que são os identificadores fortes que o Zernio expõe no webhook.
      if (conversation.isNew && direction === "incoming" && !conversation.clientId) {
        const match = await findClientMatch(conversation.platform, {
          phoneNumber: sender.phoneNumber,
          username: sender.username,
        });
        if (match) {
          await linkConversationToClient({
            conversationId: rawMessage.conversationId,
            platform: conversation.platform,
            accountId: conversation.accountId,
            clientId: match.id,
          });
        }
      }

      // Eco de uma mensagem outgoing que já enviamos via POST /conversations/:id/messages:
      // o webhook às vezes reporta um id diferente do id retornado na resposta síncrona
      // do envio, então o dedup por id (onConflictDoNothing) não pega — checamos por
      // conteúdo + janela de tempo para não duplicar a mensagem na UI.
      if (direction === "outgoing" && (await hasRecentOutgoingMessage(rawMessage.conversationId, text, timestamp))) {
        return res.json({ ok: true });
      }

      const rawId = rawMessage.id ?? payload.id;
      if (!rawId) {
        // Não deveria acontecer para message.received/message.sent (id é campo
        // obrigatório na doc do Zernio) — loga para investigação, mas ainda insere
        // com um id gerado para não perder a mensagem (não há como deduplicar retries
        // deste caso específico sem um id estável vindo do Zernio).
        console.warn("[zernio-webhook] mensagem sem id no payload — dedup de retry não garantida", {
          conversationId: rawMessage.conversationId,
          eventType,
        });
      }

      const storedMessage = {
        id: rawId ?? crypto.randomUUID(),
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
