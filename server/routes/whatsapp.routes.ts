import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  campaigns,
  clients,
  whatsappCampaignImpacts,
  whatsappCampaigns,
  whatsappCampaignMessages,
  whatsappChannels,
} from "@shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { sendTextMessage, sendTemplateMessage } from "../integrations/whatsapp";
import {
  listCampaigns,
  getCampaignDetails,
  getCampaignStats,
  getCampaignBotStats,
} from "../controllers/campaigns/campaign-logger";
import { normalizePhoneE164 } from "@shared/phone";
import {
  listBotDispatchHistory,
  parseBotSessionHistoryQuery,
} from "../controllers/whatsapp/bot-session-history.controller";
import {
  buildCampaignContentSnapshot,
  applyCampaignTag,
  DEFAULT_DEDUPE_WINDOW_HOURS,
  fingerprintForClient,
  findConflict,
  MAX_DEDUPE_WINDOW_HOURS,
} from "../services/whatsapp-campaign-dedupe.service";
import {
  resolveChannelById,
} from "../services/whatsapp-channels.service";
import {
  resolveCampaignAudience,
  type CampaignAudienceSelector,
} from "../services/whatsapp-campaign-audience.service";
import { analyzeBotCompatibility } from "../services/whatsapp-bot-compatibility.service";
import { requeueFailedMessages } from "../services/whatsapp-campaign.service";
import { transitionWhatsappCampaign } from "../services/whatsapp-campaign-lifecycle.service";
import { createAtomicWhatsappCampaign } from "../services/whatsapp-campaign-creation.service";
import { respondWhatsappError, waError } from "../services/whatsapp-errors";
import { requireAdminOrGerente } from "../middleware/validation";

const router = Router();

router.use("/campaigns", requireAdminOrGerente);

const audienceSelectorSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("explicit"), clientIds: z.array(z.string().uuid()).min(1) }),
  z.object({
    mode: z.literal("filter"),
    search: z.string().trim().max(200).optional(),
    whatsappTagIds: z.array(z.string().uuid()).default([]),
    exclusiveWhatsappTags: z.boolean().default(false),
    excludedClientIds: z.array(z.string().uuid()).default([]),
  }),
]);

// ── Enviar mensagem de texto ──────────────────────────────────────────────────

router.post("/messages", async (req, res) => {
  const schema = z.object({
    to: z.string().min(8),
    text: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }

  try {
    const result = await sendTextMessage(parsed.data.to, parsed.data.text);
    res.status(201).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar mensagem";
    res.status(500).json({ message });
  }
});

// ── Enviar template message ───────────────────────────────────────────────────

router.post("/template-messages", async (req, res) => {
  const schema = z.object({
    to: z.string().min(8),
    templateName: z.string().min(1),
    languageCode: z.string().default("pt_BR"),
    components: z.array(z.record(z.unknown())).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }

  try {
    const { to, templateName, languageCode, components } = parsed.data;
    const result = await sendTemplateMessage(to, templateName, languageCode, components);
    res.status(201).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar template";
    res.status(500).json({ message });
  }
});

// ── Criar e disparar campanha WA ──────────────────────────────────────────────
// Recebe um campaignId (tabela campaigns) com waEnabled + waTemplateId
// e uma lista de clientIds do CRM. Agenda mensagens e executa imediatamente.

router.post("/campaigns/preview", async (req, res) => {
  const parsed = z.object({
    campaignId: z.string().uuid(),
    audience: audienceSelectorSchema,
    scheduledAt: z.string().datetime().optional(),
    dedupeWindowHours: z.number().int().min(1).max(MAX_DEDUPE_WINDOW_HOURS)
      .default(DEFAULT_DEDUPE_WINDOW_HOURS),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }
  try {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, parsed.data.campaignId));
    if (!campaign) throw waError("CAMPAIGN_NOT_FOUND");
    const rows = await resolveCampaignAudience(db, parsed.data.audience as CampaignAudienceSelector);
    const snapshot = await buildCampaignContentSnapshot(db, campaign);
    const scheduledFor = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : new Date();
    const seenPhones = new Set<string>();
    let optedOut = 0;
    let invalidPhone = 0;
    let duplicatePhone = 0;
    let suppressedDuplicate = 0;
    const conflicts: Array<{
      campaignId: string;
      campaignMessageId: string;
      scheduledFor: string;
      phoneMasked: string;
    }> = [];
    for (const client of rows) {
      if (client.whatsappOptOut) {
        optedOut++;
        continue;
      }
      const phone = normalizePhoneE164(client.phone);
      if (!phone) {
        invalidPhone++;
        continue;
      }
      if (seenPhones.has(phone)) {
        duplicatePhone++;
        continue;
      }
      seenPhones.add(phone);
      const conflict = await findConflict(
        db,
        phone,
        fingerprintForClient(snapshot, client as typeof clients.$inferSelect, phone),
        scheduledFor,
        parsed.data.dedupeWindowHours,
      );
      if (conflict) {
        suppressedDuplicate++;
        if (conflicts.length < 10) {
          conflicts.push({ ...conflict, scheduledFor: conflict.scheduledFor.toISOString() });
        }
      }
    }
    return res.json({
      selected: rows.length,
      eligible: seenPhones.size - suppressedDuplicate,
      optedOut,
      invalidPhone,
      duplicatePhone,
      suppressedDuplicate,
      conflicts,
    });
  } catch (error) {
    return respondWhatsappError(res, error, "[WA campaigns preview]");
  }
});

const createWhatsappCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  waTemplateId: z.string().min(1).optional(),
  waBotId: z.string().min(1).optional(),
  waChannelId: z.number().int().positive(),
  metaTemplateName: z.string().trim().min(1).optional(),
  metaTemplateLanguage: z.string().trim().min(1).optional(),
  metaTemplateCategory: z.string().trim().min(1).optional(),
  metaTemplateBodyParams: z.array(z.string()).optional(),
  metaTemplateHeaderParams: z.array(z.string()).optional(),
  metaTemplateHeaderMedia: z.object({
    storageKey: z.string().min(1),
    mediaType: z.enum(["image", "video", "document"]),
  }).optional(),
  audience: audienceSelectorSchema,
  scheduledAt: z.string().datetime().optional(),
  dedupeWindowHours: z.number().int().min(1).max(MAX_DEDUPE_WINDOW_HOURS)
    .default(DEFAULT_DEDUPE_WINDOW_HOURS),
  postSendWhatsappTagId: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  const hasTemplate = Boolean(value.waTemplateId || value.metaTemplateName);
  const hasBot = Boolean(value.waBotId);
  if (hasTemplate === hasBot) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecione exatamente um conteúdo: template ou bot",
      path: ["waTemplateId"],
    });
  }
});

router.post("/campaigns", async (req, res) => {
  const parsed = createWhatsappCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: "Não autenticado" });

  try {
    const [channel] = await db
      .select({
        id: whatsappChannels.id,
        provider: whatsappChannels.provider,
        connectionStatus: whatsappChannels.connectionStatus,
      })
      .from(whatsappChannels)
      .where(
        and(
          eq(whatsappChannels.id, parsed.data.waChannelId),
          eq(whatsappChannels.isActive, true),
          isNull(whatsappChannels.deletedAt),
        ),
      )
      .limit(1);
    const resolvedChannel = channel ? await resolveChannelById(channel.id) : null;
    if (
      !resolvedChannel ||
      (resolvedChannel.provider === "evolution" && channel?.connectionStatus !== "connected")
    ) {
      throw waError("CHANNEL_DISCONNECTED", {
        technicalMessage: `Canal ${parsed.data.waChannelId} desconectado ou sem configuração`,
      });
    }
    if ((parsed.data.waTemplateId || parsed.data.metaTemplateName) && resolvedChannel.provider !== "cloud_api") {
      throw waError("CHANNEL_NOT_CLOUD_API", {
        technicalMessage: `Canal ${parsed.data.waChannelId} é ${resolvedChannel.provider}`,
      });
    }
    if (parsed.data.waBotId) {
      const compatibility = await analyzeBotCompatibility(parsed.data.waBotId, channel.id);
      if (!compatibility.compatible) {
        throw waError("BOT_INCOMPATIBLE_CHANNEL", { details: { compatibility } });
      }
    }

    const result = await createAtomicWhatsappCampaign({ ...parsed.data, createdBy: userId });
    return res.status(202).json(result);
  } catch (error) {
    return respondWhatsappError(res, error, "[WA campaigns]");
  }
});

// ── Reprocessar mensagens com falha ───────────────────────────────────────────
// Reenfileira (failed → scheduled) e marca a campanha como in_progress para que
// o job whatsapp-campaign-dispatcher retente o envio em segundo plano.

router.post("/campaigns/:id/retry-failed", async (req, res) => {
  const campaignId = req.params.id;
  const parsed = z.object({
    overrideDedupe: z.boolean().default(false),
    reason: z.string().trim().max(500).optional(),
  }).superRefine((value, context) => {
    if (value.overrideDedupe && (!value.reason || value.reason.length < 10)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Informe um motivo com pelo menos 10 caracteres para ignorar conflitos.",
      });
    }
  }).safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }
  try {
    const result = await requeueFailedMessages(campaignId, parsed.data.overrideDedupe
      ? { actorId: req.user!.userId, overrideDedupe: true, reason: parsed.data.reason! }
      : { actorId: req.user!.userId, overrideDedupe: false });
    res.json({ campaignId, ...result });
  } catch (e) {
    return respondWhatsappError(res, e, "[WA campaigns retry-failed]");
  }
});

router.post("/campaigns/:id/retry-tags", async (req, res) => {
  const campaignId = req.params.id;
  try {
    const [campaign] = await db
      .select({ tagId: whatsappCampaigns.postSendWhatsappTagId })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, campaignId));
    if (!campaign?.tagId) {
      return res.status(400).json({ message: "Campanha sem etiqueta pós-envio configurada" });
    }
    const messages = await db
      .select()
      .from(whatsappCampaignMessages)
      .where(and(
        eq(whatsappCampaignMessages.campaignId, campaignId),
        eq(whatsappCampaignMessages.tagApplicationStatus, "failed"),
      ));
    let applied = 0;
    for (const message of messages) {
      try {
        await applyCampaignTag(message.contactId, campaign.tagId);
        await db
          .update(whatsappCampaignMessages)
          .set({ tagApplicationStatus: "applied", tagApplicationError: null, updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, message.id));
        applied++;
      } catch (error) {
        console.error(`[WA campaigns] retry tag ${message.id}:`, error);
      }
    }
    return res.json({ campaignId, attempted: messages.length, applied });
  } catch (error) {
    console.error("[WA campaigns] erro ao reaplicar etiquetas:", error);
    return res.status(500).json({ message: "Erro ao reaplicar etiquetas" });
  }
});

// ── Pausar / Retomar / Cancelar campanha ──────────────────────────────────────

router.post("/campaigns/:id/pause", async (req, res) => {
  try {
    const result = await transitionWhatsappCampaign(req.params.id, "pause");
    return res.json(result);
  } catch (e) {
    return respondWhatsappError(res, e, "[WA campaigns pause]");
  }
});

router.post("/campaigns/:id/resume", async (req, res) => {
  try {
    const result = await transitionWhatsappCampaign(req.params.id, "resume");
    return res.json(result);
  } catch (e) {
    return respondWhatsappError(res, e, "[WA campaigns resume]");
  }
});

router.post("/campaigns/:id/cancel", async (req, res) => {
  try {
    const result = await transitionWhatsappCampaign(req.params.id, "cancel");
    return res.json(result);
  } catch (e) {
    return respondWhatsappError(res, e, "[WA campaigns cancel]");
  }
});

// ── Listar campanhas ──────────────────────────────────────────────────────────

router.get("/campaigns", async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const rows = await listCampaigns({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    res.json({ campaigns: rows, total: rows.length });
  } catch (e) {
    res.status(500).json({ message: "Erro ao listar campanhas" });
  }
});

// ── Detalhes de uma campanha ──────────────────────────────────────────────────

router.get("/campaigns/:id", async (req, res) => {
  try {
    const details = await getCampaignDetails(req.params.id);
    if (!details) return res.status(404).json({ message: "Campanha não encontrada" });
    res.json(details);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar detalhes da campanha" });
  }
});

// ── Estatísticas de uma campanha ──────────────────────────────────────────────

router.get("/campaigns/:id/stats", async (req, res) => {
  try {
    const stats = await getCampaignStats(req.params.id);
    if (!stats) return res.status(404).json({ message: "Campanha não encontrada" });
    res.json({ campaignId: req.params.id, stats, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar estatísticas da campanha" });
  }
});

// ── Estatísticas de sessões de bot de uma campanha ────────────────────────────

router.get("/campaigns/:id/bot-stats", async (req, res) => {
  try {
    const stats = await getCampaignBotStats(req.params.id);
    res.json({ campaignId: req.params.id, stats, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar estatísticas de bot da campanha" });
  }
});

// ── Histórico de disparos de bot (manuais + via campanha) ────────────────────

router.get("/bot-sessions", async (req, res) => {
  try {
    const filters = parseBotSessionHistoryQuery(req.query as Record<string, unknown>);
    const result = await listBotDispatchHistory(filters);
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Parâmetros inválidos", errors: e.flatten() });
    }
    console.error("[WA BotSessions] Erro ao listar histórico:", e);
    res.status(500).json({ message: "Erro ao buscar histórico de bots" });
  }
});

export default router;
