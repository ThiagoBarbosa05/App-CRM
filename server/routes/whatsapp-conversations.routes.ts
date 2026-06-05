import { Router } from "express";
import { z } from "zod";
import {
  listClientsForChat,
  getConversation,
  sendConversationMessage,
  markConversationRead,
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
    console.error("[WA Conversations] Erro ao listar clientes:", err);
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
});

router.get("/conversations/:clientId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const messages = await getConversation(req.params.clientId, user.userId, user.role);
    if (messages === null) return res.status(404).json({ message: "Cliente não encontrado" });

    res.json(Array.isArray(messages) ? messages : []);
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
    await markConversationRead(user.userId, req.params.clientId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao marcar como lido:", err);
    res.status(500).json({ message: "Erro ao marcar como lido" });
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

    console.log(`[WA Conversations] Enviando mensagem para cliente ${req.params.clientId} por usuário ${user.userId}`);

    const result = await sendConversationMessage(
      req.params.clientId,
      parsed.data.message,
      user.userId,
      user.role,
    );

    if (result === null) {
      console.warn(`[WA Conversations] sendConversationMessage retornou null para cliente ${req.params.clientId}`);
      return res.status(400).json({ message: "Não foi possível enviar a mensagem" });
    }

    console.log(`[WA Conversations] Mensagem enviada com sucesso:`, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao enviar mensagem:`, err);
    res.status(500).json({ message: "Erro ao enviar mensagem", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
