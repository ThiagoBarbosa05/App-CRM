import { Router } from "express";
import { z } from "zod";
import {
  listClientsForChat,
  getConversation,
  sendConversationMessage,
  markConversationRead,
  resolveConversationIdByClientId,
  startConversationByClientId,
  retryFailedMessage,
} from "../services/whatsapp-conversations.service";
import { fetchMediaStream } from "../integrations/whatsapp";
import { addConversationSseClient, addSseClient } from "../lib/sse-hub";

const router = Router();

router.get("/media/:mediaId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).end();

    const { stream, contentType, contentLength } = await fetchMediaStream(req.params.mediaId);
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const { Readable } = await import("stream");
    Readable.fromWeb(stream as any).pipe(res);
  } catch (err) {
    console.error("[WA Media] Erro ao buscar mídia:", err);
    res.status(502).json({ message: "Erro ao buscar mídia" });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await listClientsForChat(user.userId, user.role, search);
    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao listar conversas:", err);
    res.status(500).json({ message: "Erro ao listar conversas" });
  }
});

router.get("/conversations/:clientId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationIdByClientId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await getConversation(conversationId, user.userId, user.role);
    if (result === null) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json(result);
  } catch {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});

router.get("/notifications/stream", (req, res) => {
  const user = (req as any).user;
  if (!user?.userId) return res.status(401).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cleanup = addSseClient(user.userId, res);
  req.on("close", cleanup);
});

router.get("/conversations/:clientId/stream", (req, res) => {
  const user = (req as any).user;
  if (!user?.userId) return res.status(401).end();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cleanup = addConversationSseClient(req.params.clientId, res);
  req.on("close", cleanup);
});

router.post("/conversations/:clientId/read", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationIdByClientId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    await markConversationRead(user.userId, conversationId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao marcar como lido:", err);
    res.status(500).json({ message: "Erro ao marcar como lido" });
  }
});

const startConversationSchema = z.object({
  clientId: z.string().min(1),
});

router.post("/conversations/start", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = startConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const result = await startConversationByClientId(parsed.data.clientId);
    if (!result) {
      return res.status(400).json({ message: "Cliente não encontrado ou sem telefone" });
    }

    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao iniciar conversa:", err);
    res.status(500).json({ message: "Erro ao iniciar conversa" });
  }
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
});

router.post("/conversations/:clientId/messages", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const conversationId = await resolveConversationIdByClientId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await sendConversationMessage(
      conversationId,
      parsed.data.message,
      user.userId,
      user.role,
    );

    if (result === null) {
      return res.status(400).json({ message: "Não foi possível enviar a mensagem" });
    }

    res.json(result);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao enviar mensagem:`, err);
    res.status(500).json({ message: "Erro ao enviar mensagem", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/conversations/:clientId/messages/:messageId/retry", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const result = await retryFailedMessage(
      req.params.messageId,
      req.params.clientId,
      user.userId,
      user.role,
    );

    if (!result) return res.status(404).json({ message: "Mensagem não encontrada ou já enviada" });

    res.json({ status: result });
  } catch (err) {
    console.error(`[WA Conversations] Erro ao reenviar mensagem:`, err);
    res.status(500).json({ message: "Erro ao reenviar mensagem" });
  }
});

export default router;
