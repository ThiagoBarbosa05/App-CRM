import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import {
  listClientsForChat,
  listWhatsappTagsForFilter,
  getConversation,
  sendConversationMessage,
  addConversationNote,
  listConversationNotes,
  sendConversationTemplate,
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
  listSavedStickers,
  saveSticker,
  deleteSavedSticker,
  listQuickReplies,
  createQuickReply,
  deleteQuickReply,
  transferConversation,
  transferConversationToUser,
  transferConversationToSector,
  setContactWhatsappTags,
  closeConversation,
  reopenConversation,
  isConversationAccessibleToUser,
  isClientAccessibleToUser,
} from "../services/whatsapp-conversations.service";
import { startBotSession, terminateActiveSessionForConversationClose } from "../services/whatsapp-bot-engine.service";
import { clampLimit, decodeCursor } from "../lib/cursor-pagination";
import { clientsService } from "../services/clients.service";
import { downloadMediaToBuffer } from "../integrations/whatsapp";
import { resolveChannelById } from "../services/whatsapp-channels.service";
import { uploadWhatsappMedia, getWhatsappMediaObject } from "../lib/r2";
import { addConversationSseClient, addSseClient } from "../lib/sse-hub";
import { isAdminOrGerente } from "../middleware/validation";

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
  "application/vnd.ms-excel",
  "text/csv",
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

    if (media.conversationId) {
      const accessible = await isConversationAccessibleToUser(media.conversationId, user.userId, user.role);
      if (!accessible) return res.status(403).json({ message: "Acesso negado a esta mídia" });
    }

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

    // O handle de mídia da Meta é válido apenas nas credenciais do canal que o
    // gerou — buscar com as credenciais globais/padrão falha (502) quando a
    // mensagem foi enviada por um canal WhatsApp não-padrão.
    let channelOverride: { phoneNumberId: string; accessToken: string } | undefined;
    if (media.channelId != null) {
      const resolved = await resolveChannelById(media.channelId);
      if (resolved?.provider === "cloud_api") {
        channelOverride = { phoneNumberId: resolved.phoneNumberId, accessToken: resolved.accessToken };
      }
    }

    const { buffer, contentType, size } = await downloadMediaToBuffer(media.whatsappMediaId, channelOverride);

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

router.get("/tags", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const tags = await listWhatsappTagsForFilter();
    res.json(tags);
  } catch {
    res.status(500).json({ message: "Erro ao listar tags" });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const tagIds = Array.isArray(req.query.tagIds)
      ? (req.query.tagIds as string[])
      : typeof req.query.tagIds === "string"
        ? [req.query.tagIds]
        : undefined;
    const sectorIds = Array.isArray(req.query.sectorIds)
      ? (req.query.sectorIds as string[])
      : typeof req.query.sectorIds === "string"
        ? [req.query.sectorIds]
        : undefined;
    const channelIds = (
      Array.isArray(req.query.channelIds)
        ? (req.query.channelIds as string[])
        : typeof req.query.channelIds === "string"
          ? [req.query.channelIds]
          : []
    )
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    const attendantId = typeof req.query.attendantId === "string" ? req.query.attendantId : undefined;
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const cursor = decodeCursor(req.query.cursor);
    const limit = clampLimit(req.query.limit, { fallback: 20, max: 100 });
    // Com busca ativa, ignora o filtro de status — o usuário quer encontrar a
    // conversa em qualquer aba, inclusive entre as encerradas.
    const status = search ? undefined : req.query.status === "closed" ? "closed" : "open";
    const result = await listClientsForChat(
      user.userId,
      user.role,
      search,
      tagIds,
      { cursor, limit },
      status,
      {
        sectorIds,
        attendantId,
        channelIds: channelIds.length > 0 ? channelIds : undefined,
        dateFrom,
        dateTo,
      },
    );
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

    const cursor = decodeCursor(req.query.cursor);
    const limit = clampLimit(req.query.limit, { fallback: 20, max: 50 });
    const result = await getConversation(conversationId, user.userId, user.role, {
      cursor,
      limit,
    });
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

router.get("/conversations/:clientId/stream", async (req, res) => {
  const user = (req as any).user;
  if (!user?.userId) return res.status(401).end();

  const conversationId = await resolveConversationId(req.params.clientId);
  if (conversationId) {
    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const cleanup = addConversationSseClient(req.params.clientId, user.userId, user.role, res);
  req.on("close", cleanup);
});

router.post("/conversations/:clientId/read", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

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

    const result = await startConversationByClientId(
      parsed.data.clientId,
      user.userId,
      user.role,
    );
    if (!result) {
      return res.status(403).json({ message: "Cliente não encontrado ou sem permissão" });
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

const sendNoteSchema = z.object({
  content: z.string().min(1),
});

router.post("/conversations/:clientId/notes", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = sendNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await addConversationNote(
      conversationId,
      parsed.data.content,
      user.userId,
      user.role,
    );

    if (result === null) {
      return res.status(400).json({ message: "Não foi possível adicionar a nota" });
    }

    res.json(result);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao adicionar nota:`, err);
    res.status(500).json({ message: "Erro ao adicionar nota", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/conversations/:clientId/notes", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const notes = await listConversationNotes(conversationId, user.userId, user.role);
    if (notes === null) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json(notes);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao buscar notas:`, err);
    res.status(500).json({ message: "Erro ao buscar notas" });
  }
});

const sendTemplateSchema = z.object({
  templateName: z.string().min(1),
  languageCode: z.string().min(1).default("pt_BR"),
  // "NAMED" → parâmetros com parameter_name; "POSITIONAL" ou ausente → sem ele.
  parameterFormat: z.enum(["NAMED", "POSITIONAL"]).optional(),
  bodyParams: z
    .array(z.object({ name: z.string().optional(), value: z.string() }))
    .optional(),
  previewText: z.string().optional(),
  channelId: z.number().int().positive().optional(),
  // Mídia de cabeçalho escolhida no envio (biblioteca de mídia). Quando presente,
  // tem prioridade sobre a mídia padrão configurada para o template.
  headerMedia: z
    .object({
      storageKey: z.string().min(1),
      mediaType: z.enum(["image", "video", "document"]),
    })
    .optional(),
  templateButtons: z
    .array(z.object({ type: z.string(), text: z.string() }))
    .optional(),
});

router.post("/conversations/:clientId/messages/template", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = sendTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const result = await sendConversationTemplate(
      conversationId,
      user.userId,
      user.role,
      parsed.data.templateName,
      parsed.data.languageCode,
      parsed.data.bodyParams,
      parsed.data.previewText,
      parsed.data.channelId,
      parsed.data.headerMedia,
      parsed.data.parameterFormat,
      parsed.data.templateButtons,
    );

    if (result === null) {
      return res.status(400).json({ message: "Não foi possível enviar o template" });
    }

    res.json(result);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao enviar template:`, err);
    res.status(400).json({ message: err instanceof Error ? err.message : "Erro ao enviar template" });
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

// ── Figurinhas salvas ────────────────────────────────────────────────────────

router.get("/stickers", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const rows = await listSavedStickers(user.userId);
    res.json(rows);
  } catch (err) {
    console.error("[WA Stickers] Erro ao listar:", err);
    res.status(500).json({ message: "Erro ao listar figurinhas" });
  }
});

router.post("/stickers", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const { mediaId } = z.object({ mediaId: z.string().min(1) }).parse(req.body);
    const row = await saveSticker(user.userId, mediaId);
    res.json(row ?? { message: "Já salva" });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.flatten() });
    console.error("[WA Stickers] Erro ao salvar:", err);
    res.status(500).json({ message: "Erro ao salvar figurinha" });
  }
});

router.delete("/stickers/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const row = await deleteSavedSticker(user.userId, req.params.id);
    if (!row) return res.status(404).json({ message: "Figurinha não encontrada" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Stickers] Erro ao remover:", err);
    res.status(500).json({ message: "Erro ao remover figurinha" });
  }
});

// ── Respostas rápidas ────────────────────────────────────────────────────────

router.get("/quick-replies", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const rows = await listQuickReplies(user.userId);
    res.json(rows);
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao listar:", err);
    res.status(500).json({ message: "Erro ao listar respostas rápidas" });
  }
});

const quickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
});

router.post("/quick-replies", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const parsed = quickReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const row = await createQuickReply(user.userId, parsed.data.title, parsed.data.content);
    if (!row) return res.status(409).json({ message: "Já existe uma resposta com esse título" });
    res.status(201).json(row);
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao criar:", err);
    res.status(500).json({ message: "Erro ao criar resposta rápida" });
  }
});

router.delete("/quick-replies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const row = await deleteQuickReply(user.userId, req.params.id);
    if (!row) return res.status(404).json({ message: "Resposta não encontrada" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA QuickReplies] Erro ao remover:", err);
    res.status(500).json({ message: "Erro ao remover resposta rápida" });
  }
});

// ── Disparar bot em conversa ─────────────────────────────────────────────────

const triggerBotSchema = z.object({
  botId: z.string().min(1),
  channelId: z.number().int().positive().optional(),
});

router.post("/conversations/:conversationId/trigger-bot", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = triggerBotSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

    const phone = await getConversationPhone(conversationId);
    if (!phone) return res.status(404).json({ message: "Telefone da conversa não encontrado" });

    const result = await startBotSession(
      parsed.data.botId,
      phone,
      undefined,
      undefined,
      parsed.data.channelId,
      user.userId,
    );

    if (result.status === "no_start_node") {
      return res.status(400).json({ message: "Bot sem nó inicial configurado" });
    }
    if (result.status === "already_active") {
      return res.status(409).json({ message: "Já existe uma sessão de bot ativa para este contato" });
    }
    if (result.status === "opted_out") {
      return res.status(409).json({ message: "Cliente optou por não receber mensagens de marketing" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA TriggerBot] Erro ao disparar bot:", err);
    res.status(500).json({ message: "Erro ao disparar bot", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const linkClientSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")),
    cpf: z.string().optional(),
    birthday: z.string().optional(),
    categoria: z.string().optional(),
    origem: z.string().optional(),
    responsavelId: z.string().optional(),
  }),
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

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

    if (parsed.data.action === "link") {
      const updated = await linkClientToConversation(conversationId, parsed.data.clientId);
      if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });
      return res.json({ ok: true, conversationId, clientId: parsed.data.clientId });
    }

    // action === "create": busca phone da conversa, cria cliente, vincula
    const phone = await getConversationPhone(conversationId);
    if (!phone) return res.status(404).json({ message: "Conversa não encontrada" });

    const d = parsed.data;
    const result = await clientsService.createClient({
      userId: user.userId,
      userRole: user.role,
      clientData: {
        name: d.name,
        phone,
        email: d.email || undefined,
        cpf: d.cpf || undefined,
        birthday: d.birthday || undefined,
        categoria: d.categoria || "Geral",
        origem: d.origem || "WhatsApp",
        responsavelId: d.responsavelId || undefined,
      },
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

const setWhatsappTagsSchema = z.object({ tagIds: z.array(z.string()) });

router.put("/conversations/:clientId/whatsapp-tags", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = setWhatsappTagsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (conversationId) {
      const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
      if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });
    } else {
      // Cliente ainda sem conversa de WhatsApp — não há o que checar via
      // isConversationAccessibleToUser, então cai no fallback de posse do
      // cliente (responsavelId), evitando que um vendedor tagueie clientes
      // arbitrários que ainda não têm conversa.
      const accessible = await isClientAccessibleToUser(req.params.clientId, user.userId, user.role);
      if (!accessible) return res.status(403).json({ message: "Acesso negado a este cliente" });
    }

    await setContactWhatsappTags(req.params.clientId, parsed.data.tagIds);
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao atualizar tags:", err);
    res.status(500).json({ message: "Erro ao atualizar tags" });
  }
});

function requireAdminOrGerente(req: any, res: any): boolean {
  if (!req.user?.userId) {
    res.status(401).json({ message: "Não autenticado" });
    return false;
  }
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return false;
  }
  return true;
}

const transferSchema = z.object({
  channelId: z.number().int().positive(),
  reason: z.string().trim().min(1).optional(),
});

router.post("/conversations/:conversationId/transfer", async (req, res) => {
  try {
    if (!requireAdminOrGerente(req, res)) return;

    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const updated = await transferConversation(conversationId, parsed.data.channelId, parsed.data.reason);
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao transferir conversa:", err);
    res.status(500).json({ message: "Erro ao transferir conversa" });
  }
});

const transferAttendantSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().trim().min(1).optional(),
});

router.post("/conversations/:conversationId/transfer-attendant", async (req, res) => {
  try {
    if (!requireAdminOrGerente(req, res)) return;

    const parsed = transferAttendantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const updated = await transferConversationToUser(conversationId, parsed.data.targetUserId, parsed.data.reason);
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao transferir conversa";
    console.error("[WA Conversations] Erro ao transferir conversa por atendente:", err);
    res.status(400).json({ message });
  }
});

const transferSectorSchema = z.object({
  sectorId: z.string().min(1),
  reason: z.string().trim().min(1).optional(),
});

router.post("/conversations/:conversationId/transfer-sector", async (req, res) => {
  try {
    if (!requireAdminOrGerente(req, res)) return;

    const parsed = transferSectorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const updated = await transferConversationToSector(conversationId, parsed.data.sectorId, parsed.data.reason);
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao transferir conversa";
    console.error("[WA Conversations] Erro ao transferir conversa por setor:", err);
    res.status(400).json({ message });
  }
});

router.post("/conversations/:conversationId/close", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

    const updated = await closeConversation(conversationId, user.userId);
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    // Sem isso, uma sessão de bot ainda ativa nesse telefone ficaria "Em
    // execução" para sempre no histórico de bots, mesmo com a conversa encerrada.
    await terminateActiveSessionForConversationClose(updated.phone).catch((err) =>
      console.error("[WA Conversations] Erro ao encerrar sessão de bot ao fechar conversa:", err),
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao encerrar conversa:", err);
    res.status(500).json({ message: "Erro ao encerrar conversa" });
  }
});

router.post("/conversations/:conversationId/reopen", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.conversationId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

    const updated = await reopenConversation(conversationId);
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao reabrir conversa:", err);
    res.status(500).json({ message: "Erro ao reabrir conversa" });
  }
});

export default router;
