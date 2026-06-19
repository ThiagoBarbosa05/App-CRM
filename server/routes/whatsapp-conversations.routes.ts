import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import {
  listClientsForChat,
  getConversation,
  sendConversationMessage,
  sendConversationMedia,
  sendConversationReaction,
  markConversationRead,
  resolveConversationId,
  startConversationByClientId,
  retryFailedMessage,
  getMediaById,
  updateMediaStorageKey,
  linkClientToConversation,
  getConversationPhone,
} from "../services/whatsapp-conversations.service";
import { clientsService } from "../services/clients.service";
import { downloadMediaToBuffer } from "../integrations/whatsapp";
import { uploadWhatsappMedia, getWhatsappMediaObject } from "../lib/r2";
import { addConversationSseClient, addSseClient } from "../lib/sse-hub";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/3gpp",
  "audio/mpeg", "audio/ogg", "audio/opus", "audio/aac", "audio/mp4", "audio/webm",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

router.post("/conversations/:clientId/messages/media", upload.single("file"), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
    if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: `Tipo de arquivo não suportado: ${req.file.mimetype}` });
    }

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const channelId = req.body.channelId ? Number(req.body.channelId) : undefined;
    const caption = typeof req.body.caption === "string" && req.body.caption.trim() ? req.body.caption.trim() : undefined;
    const replyToMessageId = typeof req.body.replyToMessageId === "string" ? req.body.replyToMessageId : undefined;

    const result = await sendConversationMedia(
      conversationId,
      { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size },
      user.userId,
      user.role,
      channelId,
      caption,
      replyToMessageId,
    );

    if (!result) return res.status(400).json({ message: "Não foi possível enviar o arquivo" });

    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao enviar mídia:", err);
    res.status(500).json({ message: "Erro ao enviar arquivo", detail: err instanceof Error ? err.message : String(err) });
  }
});

// :mediaId é o id da linha whatsapp_media. Serve do R2 quando já persistido;
// caso contrário busca na Meta, persiste (cache-on-read) e devolve.
router.get("/media/:mediaId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).end();

    const media = await getMediaById(req.params.mediaId);
    if (!media) return res.status(404).json({ message: "Mídia não encontrada" });

    if (media.storageKey) {
      try {
        const obj = await getWhatsappMediaObject(media.storageKey);
        res.setHeader("Content-Type", media.mimeType ?? obj.ContentType ?? "application/octet-stream");
        if (obj.ContentLength != null) res.setHeader("Content-Length", String(obj.ContentLength));
        res.setHeader("Cache-Control", "private, max-age=3600");
        (obj.Body as NodeJS.ReadableStream).pipe(res);
        return;
      } catch (err) {
        console.error("[WA Media] Falha ao servir do R2, tentando Meta:", err);
      }
    }

    if (!media.whatsappMediaId) return res.status(404).json({ message: "Mídia indisponível" });

    const { buffer, contentType, size } = await downloadMediaToBuffer(media.whatsappMediaId);

    // Persiste em background (cache-on-read) — não bloqueia a resposta.
    uploadWhatsappMedia(buffer, media.mimeType ?? contentType)
      .then((storageKey) => updateMediaStorageKey(media.id, storageKey, size))
      .catch((err) => console.error("[WA Media] Falha ao cachear mídia no R2:", err));

    res.setHeader("Content-Type", media.mimeType ?? contentType);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
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

    const conversationId = await resolveConversationId(req.params.clientId);
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

    const conversationId = await resolveConversationId(req.params.clientId);
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
  channelId: z.number().int().positive().optional(),
  replyToMessageId: z.string().optional(),
});

router.post("/conversations/:clientId/messages", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await sendConversationMessage(
      conversationId,
      parsed.data.message,
      user.userId,
      user.role,
      parsed.data.channelId,
      parsed.data.replyToMessageId,
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

const reactionSchema = z.object({
  emoji: z.string(),
  channelId: z.number().int().positive().optional(),
});

router.post("/conversations/:clientId/messages/:messageId/reaction", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await sendConversationReaction(
      conversationId,
      req.params.messageId,
      parsed.data.emoji,
      user.userId,
      user.role,
      parsed.data.channelId,
    );

    if (!result) return res.status(404).json({ message: "Mensagem não encontrada" });

    res.json(result);
  } catch (err) {
    console.error("[WA Conversations] Erro ao enviar reação:", err);
    res.status(500).json({ message: "Erro ao enviar reação", detail: err instanceof Error ? err.message : String(err) });
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

const linkClientSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1) }),
  z.object({ action: z.literal("link"), clientId: z.string().min(1) }),
]);

router.post("/conversations/:conversationId/link-client", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = linkClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    if (parsed.data.action === "link") {
      const updated = await linkClientToConversation(conversationId, parsed.data.clientId);
      if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });
      return res.json({ ok: true, conversationId, clientId: parsed.data.clientId });
    }

    // action === "create": busca phone da conversa, cria cliente, vincula
    const phone = await getConversationPhone(conversationId);
    if (!phone) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await clientsService.createClient({
      userId: user.userId,
      userRole: user.role,
      clientData: { name: parsed.data.name, phone, categoria: "Geral", origem: "WhatsApp" },
    });

    if (!result?.id) {
      return res.status(400).json({ message: "Erro ao criar cliente" });
    }

    await linkClientToConversation(conversationId, result.id);

    res.json({ ok: true, conversationId, clientId: result.id, client: result });
  } catch (err) {
    console.error("[WA Conversations] Erro ao vincular cliente:", err);
    res.status(500).json({ message: "Erro ao vincular cliente", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
