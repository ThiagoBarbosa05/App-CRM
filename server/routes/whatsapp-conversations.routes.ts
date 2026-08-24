import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { userHasActionPermission } from "../services/whatsapp-action-permissions.service";
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
  startConversationByPhone,
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
  updateQuickReply,
  deleteQuickReply,
  transferConversation,
  transferConversationToUser,
  transferConversationToSector,
  setContactWhatsappTags,
  closeConversation,
  reopenConversation,
  isConversationAccessibleToUser,
  isClientAccessibleToUser,
  resolveOutboundChannelForSender,
  forwardConversationMessage,
  getConversationCapabilities,
  searchConversationMessages,
  getConversationMessageContext,
  WhatsappMediaInputError,
} from "../services/whatsapp-conversations.service";
import { startBotSession, terminateActiveSessionForConversationClose } from "../services/whatsapp-bot-engine.service";
import { analyzeBotCompatibility } from "../services/whatsapp-bot-compatibility.service";
import { clampLimit, decodeCursor } from "../lib/cursor-pagination";
import { clientsService } from "../services/clients.service";
import { respondWithClientError } from "../controllers/clients/handle-client-error";
import { downloadMediaToBuffer } from "../integrations/whatsapp";
import { resolveChannelById } from "../services/whatsapp-channels.service";
import { respondWhatsappError, waError } from "../services/whatsapp-errors";
import { uploadWhatsappMedia, getWhatsappMediaObject } from "../lib/r2";
import { addConversationSseClient, addSseClient } from "../lib/sse-hub";
import { isAdminOrGerente } from "../middleware/validation";
import { db } from "../db";
import { whatsappTags } from "@shared/schema";
import { randomUUID } from "crypto";
import { isWhatsappMediaMimeTypeSupported } from "@shared/whatsapp-media";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

router.post("/conversations/:clientId/messages/media", upload.single("file"), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
    if (!isWhatsappMediaMimeTypeSupported(req.file.mimetype)) {
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
    if (err instanceof WhatsappMediaInputError) {
      return res.status(400).json({ message: err.message });
    }
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
    // asChannelId: admin/gerente espiando um diálogo interno pela perspectiva do
    // outro lado do par. A autorização/validação real fica em getConversation —
    // aqui só se converte o param; valores inválidos são ignorados lá.
    const asChannelIdRaw = Number(req.query.asChannelId);
    const asChannelId = Number.isFinite(asChannelIdRaw) ? asChannelIdRaw : undefined;
    const result = await getConversation(
      conversationId,
      user.userId,
      user.role,
      { cursor, limit },
      { asChannelId },
    );
    if (result === null) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json(result);
  } catch {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});

router.get("/conversations/:clientId/messages/search", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });
    if (!(await isConversationAccessibleToUser(conversationId, user.userId, user.role))) {
      return res.status(404).json({ message: "Conversa não encontrada" });
    }

    const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
    if (query.length < 2) {
      return res.status(400).json({ message: "Digite pelo menos 2 caracteres" });
    }
    if (query.length > 200) {
      return res.status(400).json({ message: "A busca deve ter no máximo 200 caracteres" });
    }
    const result = await searchConversationMessages(conversationId, query, {
      cursor: decodeCursor(req.query.cursor),
      limit: clampLimit(req.query.limit, { fallback: 25, max: 25 }),
    });
    res.json(result);
  } catch (error) {
    console.error("[WA Conversations] Erro ao buscar mensagens:", error);
    res.status(500).json({ message: "Erro ao buscar mensagens" });
  }
});

router.get("/conversations/:clientId/messages/:messageId/context", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });
    if (!(await isConversationAccessibleToUser(conversationId, user.userId, user.role))) {
      return res.status(404).json({ message: "Conversa não encontrada" });
    }
    const asChannelIdRaw = Number(req.query.asChannelId);
    const result = await getConversationMessageContext(
      conversationId,
      req.params.messageId,
      user.userId,
      user.role,
      { asChannelId: Number.isFinite(asChannelIdRaw) ? asChannelIdRaw : undefined },
    );
    if (!result) return res.status(404).json({ message: "Mensagem não encontrada" });
    res.json({ ...result, anchorMessageId: req.params.messageId, hasNewer: true });
  } catch (error) {
    console.error("[WA Conversations] Erro ao buscar contexto da mensagem:", error);
    res.status(500).json({ message: "Erro ao buscar contexto da mensagem" });
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

  // Assina pelo conversationId resolvido (não pelo param bruto) — várias
  // conversas paralelas podem existir para o mesmo clientId, e publishConversationEvent
  // agora publica sempre por conversation.id.
  const cleanup = addConversationSseClient(conversationId ?? req.params.clientId, user.userId, user.role, res);
  req.on("close", cleanup);
});

const markReadSchema = z.object({
  asChannelId: z.number().int().positive().optional(),
});

router.post("/conversations/:clientId/read", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });

    const accessible = await isConversationAccessibleToUser(conversationId, user.userId, user.role);
    if (!accessible) return res.status(403).json({ message: "Acesso negado a esta conversa" });

    // asChannelId: lado do diálogo interno que está sendo lido (admin/gerente
    // desdobrado em duas caixas na lista). Autorização/validação real fica em
    // markConversationRead, via resolvePerspectiveOverride — mesma regra do
    // GET; valor ausente/inválido vira marcação da conversa inteira em vez de
    // erro.
    const parsed = markReadSchema.safeParse(req.body ?? {});
    const asChannelId = parsed.success ? parsed.data.asChannelId : undefined;

    await markConversationRead(user.userId, conversationId, { userRole: user.role, asChannelId });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao marcar como lido:", err);
    res.status(500).json({ message: "Erro ao marcar como lido" });
  }
});

// Aceita `clientId` (contato do CRM) OU `phone` (número avulso / número de
// outro canal nosso) — os dois caminhos de "Nova conversa".
const startConversationSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    channelId: z.number().int().positive().optional(),
  })
  .refine((d) => !!d.clientId || !!d.phone, {
    message: "Informe clientId ou phone",
    path: ["clientId"],
  });

router.post("/conversations/start", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = startConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const result = parsed.data.clientId
      ? await startConversationByClientId(
          parsed.data.clientId,
          user.userId,
          user.role,
          parsed.data.channelId,
        )
      : await startConversationByPhone(
          parsed.data.phone!,
          user.userId,
          user.role,
          parsed.data.channelId,
        );
    if (!result) {
      return res.status(403).json({ message: "Cliente não encontrado ou sem permissão" });
    }

    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "CHANNEL_NOT_ACCESSIBLE") {
      return res.status(403).json({ message: "Você não tem acesso a este canal" });
    }
    if (err instanceof Error && err.message === "INVALID_PHONE") {
      return res.status(400).json({ message: "Número de telefone inválido" });
    }
    if (err instanceof Error && err.message === "SAME_CHANNEL_PHONE") {
      return res.status(400).json({ message: "Não é possível iniciar uma conversa com o número do próprio canal" });
    }
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

    if (!(await userHasActionPermission(user, "manage_templates"))) {
      return res.status(403).json({ message: "Sem permissão para enviar templates" });
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
    if (!(await userHasActionPermission(user, "quick_replies_create"))) {
      return res.status(403).json({ message: "Sem permissão para criar respostas rápidas" });
    }
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

router.patch("/quick-replies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    if (!(await userHasActionPermission(user, "quick_replies_edit"))) {
      return res.status(403).json({ message: "Sem permissão para editar respostas rápidas" });
    }
    const parsed = quickReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const row = await updateQuickReply(user.userId, req.params.id, parsed.data.title, parsed.data.content);
    if (!row) return res.status(404).json({ message: "Resposta não encontrada" });
    res.json(row);
  } catch (err) {
    if (err instanceof Error && err.message === "DUPLICATE_TITLE") {
      return res.status(409).json({ message: "Já existe uma resposta com esse título" });
    }
    console.error("[WA QuickReplies] Erro ao editar:", err);
    res.status(500).json({ message: "Erro ao editar resposta rápida" });
  }
});

router.delete("/quick-replies/:id", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    if (!(await userHasActionPermission(user, "quick_replies_delete"))) {
      return res.status(403).json({ message: "Sem permissão para excluir respostas rápidas" });
    }
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
  channelId: z.number().int().positive(),
});

const forwardMessageSchema = z.object({
  targetConversationIds: z.array(z.string().min(1)).min(1).max(20),
});

router.post("/conversations/:clientId/messages/:messageId/forward", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const parsed = forwardMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });
    const results = await forwardConversationMessage(
      conversationId,
      req.params.messageId,
      parsed.data.targetConversationIds,
      user.userId,
      user.role,
    );
    const failed = results.filter((result) => !result.ok).length;
    res.status(failed === results.length ? 502 : 200).json({ results, failed });
  } catch (error) {
    console.error("[WA Conversations] Erro ao encaminhar mensagem:", error);
    res.status(500).json({ message: "Erro ao encaminhar mensagem" });
  }
});

router.get("/conversations/:clientId/capabilities", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const conversationId = await resolveConversationId(req.params.clientId);
    if (!conversationId) return res.status(404).json({ message: "Conversa não encontrada" });
    const parsedQuery = z.object({
      channelId: z.coerce.number().int().positive().optional(),
    }).safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ errors: parsedQuery.error.flatten() });
    }
    const capabilities = await getConversationCapabilities(
      conversationId,
      user.userId,
      user.role,
      parsedQuery.data.channelId,
    );
    if (!capabilities) return res.status(404).json({ message: "Canal não encontrado" });
    res.json(capabilities);
  } catch (error) {
    console.error("[WA Conversations] Erro ao consultar capacidades:", error);
    res.status(500).json({ message: "Erro ao consultar capacidades" });
  }
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

    const sender = await resolveOutboundChannelForSender(
      conversationId,
      user.userId,
      parsed.data.channelId,
    );
    if (!sender || sender.channelId !== parsed.data.channelId) {
      return res.status(400).json({
        message: "O canal informado não corresponde ao canal da conversa atual",
      });
    }

    const compatibility = await analyzeBotCompatibility(
      parsed.data.botId,
      parsed.data.channelId,
    );
    if (!compatibility.compatible) {
      throw waError("BOT_INCOMPATIBLE_CHANNEL", {
        details: { compatibility },
      });
    }

    const result = await startBotSession(
      parsed.data.botId,
      sender.targetPhone,
      undefined,
      undefined,
      parsed.data.channelId,
      user.userId,
      {
        source: "manual",
        conversationId,
        channelId: parsed.data.channelId,
        triggeredByUserId: user.userId,
      },
    );

    if (result.status === "no_start_node") throw waError("BOT_NO_ENTRY_NODE");
    if (result.status === "already_active") {
      // O hint padrão fala do reagendamento automático das campanhas; no
      // disparo manual não há retentativa, então a orientação é outra.
      throw waError("SEND_BOT_SESSION_ACTIVE", {
        hint: "Aguarde a conversa em andamento terminar e dispare novamente.",
      });
    }
    if (result.status === "opted_out") throw waError("SEND_OPTED_OUT");

    res.json({ ok: true });
  } catch (err) {
    return respondWhatsappError(res, err, "[WA TriggerBot]");
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
    // Duplicidade e validação viram 409/400 com frase exibível; o detalhe
    // técnico fica só no log (antes ia para o browser no campo `detail`).
    respondWithClientError(res, err, "create");
  }
});

const setWhatsappTagsSchema = z.object({ tagIds: z.array(z.string()) });

router.put("/conversations/:clientId/whatsapp-tags", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = setWhatsappTagsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    if (!(await userHasActionPermission(user, "manage_tags"))) {
      return res.status(403).json({ message: "Sem permissão para gerenciar etiquetas" });
    }

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

const perspectiveActionSchema = z.object({
  asChannelId: z.number().int().positive().optional(),
});

router.post("/tags", async (req, res) => {
  try {
    const user = (req as { user?: { userId?: string } }).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const parsed = z.object({
      name: z.string().trim().min(2).max(80),
      color: z.string().trim().max(40).optional(),
      emoji: z.string().trim().max(16).optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Etiqueta inválida", errors: parsed.error.errors });
    }
    const [tag] = await db
      .insert(whatsappTags)
      .values({
        umblerTagId: `local-${randomUUID()}`,
        name: parsed.data.name,
        color: parsed.data.color ?? "Gray",
        emoji: parsed.data.emoji ?? null,
        description: "Etiqueta criada no CRM",
      })
      .returning();
    return res.status(201).json(tag);
  } catch (error) {
    console.error("[WhatsApp tags] Erro ao criar etiqueta:", error);
    return res.status(500).json({ message: "Erro ao criar etiqueta" });
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

    const parsed = perspectiveActionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const updated = await closeConversation(
      conversationId,
      user.userId,
      user.role,
      parsed.data.asChannelId,
    );
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    // Sem isso, uma sessão de bot ainda ativa nesse telefone ficaria "Em
    // execução" para sempre no histórico de bots, mesmo com a conversa encerrada.
    if (updated.peerChannelId == null) {
      await terminateActiveSessionForConversationClose(updated.phone).catch((err) =>
        console.error("[WA Conversations] Erro ao encerrar sessão de bot ao fechar conversa:", err),
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao encerrar conversa:", err);
    if (err instanceof Error && err.message === "PERSPECTIVE_CHANNEL_REQUIRED") {
      return res.status(400).json({ message: "Informe a perspectiva que deve ser encerrada" });
    }
    if (err instanceof Error && err.message === "PERSPECTIVE_CHANNEL_NOT_ACCESSIBLE") {
      return res.status(403).json({ message: "Perspectiva não acessível ao usuário" });
    }
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

    const parsed = perspectiveActionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const updated = await reopenConversation(
      conversationId,
      user.userId,
      user.role,
      parsed.data.asChannelId,
    );
    if (!updated) return res.status(404).json({ message: "Conversa não encontrada" });

    res.json({ ok: true });
  } catch (err) {
    console.error("[WA Conversations] Erro ao reabrir conversa:", err);
    if (err instanceof Error && err.message === "PERSPECTIVE_CHANNEL_REQUIRED") {
      return res.status(400).json({ message: "Informe a perspectiva que deve ser reaberta" });
    }
    if (err instanceof Error && err.message === "PERSPECTIVE_CHANNEL_NOT_ACCESSIBLE") {
      return res.status(403).json({ message: "Perspectiva não acessível ao usuário" });
    }
    res.status(500).json({ message: "Erro ao reabrir conversa" });
  }
});

export default router;
