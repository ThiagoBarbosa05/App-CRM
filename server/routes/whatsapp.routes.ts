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
  reserveCampaignMessage,
} from "../services/whatsapp-campaign-dedupe.service";
import {
  listChannelIdsForUser,
  resolveChannelById,
} from "../services/whatsapp-channels.service";
import {
  resolveCampaignAudience,
  type CampaignAudienceSelector,
} from "../services/whatsapp-campaign-audience.service";

const router = Router();

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
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    const rows = await resolveCampaignAudience(parsed.data.audience as CampaignAudienceSelector);
    const snapshot = await buildCampaignContentSnapshot(campaign);
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
    console.error("[WA campaigns preview] erro:", error);
    return res.status(500).json({ message: "Erro ao calcular prévia" });
  }
});

router.post("/campaigns", async (req, res) => {
  const schema = z.object({
    campaignId: z.string().uuid(),
    audience: audienceSelectorSchema,
    scheduledAt: z.string().datetime().optional(),
    dedupeWindowHours: z.number().int().min(1).max(MAX_DEDUPE_WINDOW_HOURS)
      .default(DEFAULT_DEDUPE_WINDOW_HOURS),
    postSendWhatsappTagId: z.string().uuid().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }

  const {
    campaignId,
    audience,
    scheduledAt,
    dedupeWindowHours,
    postSendWhatsappTagId,
  } = parsed.data;

  // Se a data de agendamento estiver no futuro, a campanha fica "created"
  // (agendada) e o job só inicia quando startDate <= agora.
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const isScheduled = !!scheduledDate && scheduledDate.getTime() > Date.now();

  try {
    // 1. Validar campanha
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)));

    if (!campaign) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    if (!campaign.waEnabled) {
      return res.status(400).json({ message: "Campanha não está habilitada para WhatsApp (waEnabled = false)" });
    }
    if (!campaign.waTemplateId && !campaign.waBotId) {
      return res.status(400).json({ message: "Campanha não possui template ou bot configurado" });
    }
    if (Boolean(campaign.waTemplateId) === Boolean(campaign.waBotId)) {
      return res.status(400).json({
        message: "A campanha deve possuir exatamente um template ou bot",
      });
    }
    if (campaign.waChannelId == null) {
      return res.status(400).json({
        message: "A campanha não possui um canal de envio selecionado",
      });
    }

    const [channel] = await db
      .select({
        id: whatsappChannels.id,
        connectionStatus: whatsappChannels.connectionStatus,
      })
      .from(whatsappChannels)
      .where(
        and(
          eq(whatsappChannels.id, campaign.waChannelId),
          eq(whatsappChannels.isActive, true),
          isNull(whatsappChannels.deletedAt),
        ),
      )
      .limit(1);
    const resolvedChannel = channel
      ? await resolveChannelById(channel.id)
      : null;
    if (
      !resolvedChannel ||
      (resolvedChannel.provider === "evolution" &&
        channel?.connectionStatus !== "connected")
    ) {
      return res.status(400).json({
        message: "O canal da campanha está desconectado ou sem configuração",
      });
    }
    if (campaign.waTemplateId && resolvedChannel.provider !== "cloud_api") {
      return res.status(400).json({
        message: "Campanhas com template exigem um canal Cloud API",
      });
    }

    const user = req.user;
    if (!user?.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    if (user.role === "vendedor") {
      const accessibleChannelIds = await listChannelIdsForUser(user.userId);
      if (!accessibleChannelIds.includes(campaign.waChannelId)) {
        return res.status(403).json({
          message: "Você não possui acesso ao canal selecionado",
        });
      }
    }

    // 2. Buscar clientes e normalizar telefone (E.164). Contatos com telefone
    //    ausente/inválido são descartados; contatos cujo telefone normalizado
    //    já apareceu antes na lista (mesmo número real, cadastros duplicados
    //    em formatos diferentes) também são descartados, mantendo só o primeiro,
    //    para não disparar duas vezes para a mesma pessoa.
    const clientRows = await resolveCampaignAudience(audience as CampaignAudienceSelector);

    const seenPhones = new Set<string>();
    const validClients: { id: string; name: string; phone: string; phoneE164: string }[] = [];
    let skippedInvalidPhone = 0;
    let skippedDuplicatePhone = 0;
    let skippedOptedOut = 0;
    const preSuppressed: Array<{
      id: string;
      campaignId: string;
      contactId: string;
      contactName: string;
      phoneNumber: string;
      status: "suppressed";
      scheduledAt: Date;
      suppressionReason: string;
    }> = [];

    for (const c of clientRows) {
      if (c.whatsappOptOut) {
        skippedOptedOut++;
        preSuppressed.push({ id: `${campaignId}-${c.id}`, campaignId, contactId: c.id, contactName: c.name,
          phoneNumber: c.phone ?? "sem telefone", status: "suppressed", scheduledAt: scheduledDate ?? new Date(),
          suppressionReason: "Opt-out de campanhas do WhatsApp" });
        continue;
      }
      const phoneE164 = c.phone?.trim() ? normalizePhoneE164(c.phone) : null;
      if (!phoneE164) {
        skippedInvalidPhone++;
        preSuppressed.push({ id: `${campaignId}-${c.id}`, campaignId, contactId: c.id, contactName: c.name,
          phoneNumber: c.phone ?? "sem telefone", status: "suppressed", scheduledAt: scheduledDate ?? new Date(),
          suppressionReason: "Telefone inválido" });
        continue;
      }
      if (seenPhones.has(phoneE164)) {
        skippedDuplicatePhone++;
        preSuppressed.push({ id: `${campaignId}-${c.id}`, campaignId, contactId: c.id, contactName: c.name,
          phoneNumber: phoneE164, status: "suppressed", scheduledAt: scheduledDate ?? new Date(),
          suppressionReason: "Telefone duplicado na audiência" });
        continue;
      }
      seenPhones.add(phoneE164);
      validClients.push({ id: c.id, name: c.name, phone: c.phone!, phoneE164 });
    }

    if (validClients.length === 0) {
      return res.status(400).json({
        message:
          skippedOptedOut > 0 && skippedInvalidPhone === 0
            ? "Todos os clientes fornecidos optaram por não receber mensagens de marketing"
            : "Nenhum dos clientes fornecidos possui telefone válido",
      });
    }

    // 3. Garantir entrada em whatsappCampaigns (satisfaz FK de whatsappCampaignMessages)
    await db
      .insert(whatsappCampaigns)
      .values({
        id: campaignId,
        title: campaign.name,
        status: isScheduled ? "created" : "in_progress",
        totalContacts: validClients.length,
        scheduledMessages: validClients.length,
        startDate: scheduledDate ?? new Date(),
        botId: campaign.waBotId ?? campaign.waTemplateId ?? "",
        botTriggerName: "whatsapp",
        channelId: "whatsapp",
        fromPhone: "",
        intervalSeconds: 1,
        exclusiveTagFilter: false,
        tagIds: [],
        organizationId: "",
        audienceSelector: audience,
      })
      .onConflictDoUpdate({
        target: whatsappCampaigns.id,
        set: {
          status: isScheduled ? "created" : "in_progress",
          totalContacts: validClients.length,
          scheduledMessages: validClients.length,
          startDate: scheduledDate ?? new Date(),
          audienceSelector: audience,
          updatedAt: new Date(),
        },
      });

    if (preSuppressed.length > 0) {
      await db.insert(whatsappCampaignMessages).values(preSuppressed).onConflictDoNothing();
    }

    // 4. Excluir contatos que já têm mensagem não-terminal/enviada nesta campanha
    //    (reenvio do mesmo formulário, duplo clique, retry de rede no frontend
    //    não devem gerar um novo disparo para quem já está na fila ou já recebeu).
    const alreadyQueued = await db
      .select({ contactId: whatsappCampaignMessages.contactId })
      .from(whatsappCampaignMessages)
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          inArray(whatsappCampaignMessages.contactId, validClients.map((c) => c.id)),
          inArray(whatsappCampaignMessages.status, ["scheduled", "sent", "delivered", "read"]),
        ),
      );
    const alreadyQueuedIds = new Set(alreadyQueued.map((m) => m.contactId));

    const now = new Date();
    const contentSnapshot = await buildCampaignContentSnapshot(campaign);
    await db
      .update(whatsappCampaigns)
      .set({
        dedupeWindowHours,
        postSendWhatsappTagId: postSendWhatsappTagId ?? null,
        contentFingerprintSnapshot: contentSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaignId));

    let queued = 0;
    let suppressedDuplicate = 0;
    const conflicts: Array<{
      campaignId: string;
      campaignMessageId: string;
      scheduledFor: string;
      phoneMasked: string;
    }> = [];
    for (const client of validClients.filter((item) => !alreadyQueuedIds.has(item.id))) {
      const fullClient = clientRows.find((row) => row.id === client.id);
      if (!fullClient) continue;
      const result = await reserveCampaignMessage({
        campaignId,
        client: fullClient as typeof clients.$inferSelect,
        phoneNormalized: client.phoneE164,
        contentFingerprint: fingerprintForClient(
          contentSnapshot,
          fullClient as typeof clients.$inferSelect,
          client.phoneE164,
        ),
        scheduledFor: scheduledDate ?? now,
        windowHours: dedupeWindowHours,
        postSendTagRequested: Boolean(postSendWhatsappTagId),
      });
      if (result.queued) {
        queued++;
      } else {
        suppressedDuplicate++;
        if (result.conflict && conflicts.length < 10) {
          conflicts.push({
            ...result.conflict,
            scheduledFor: result.conflict.scheduledFor.toISOString(),
          });
        }
      }
    }

    /*
    const messageValues = validClients
      .filter((client) => !alreadyQueuedIds.has(client.id))
      .map((client) => ({
        // Id determinístico por (campanha, contato) — junto com o índice único
        // wa_campaign_messages_campaign_contact_uidx, onConflictDoNothing abaixo
        // vira uma rede de segurança real contra corrida na exclusão acima.
        id: `${campaignId}-${client.id}`,
        campaignId,
        contactId: client.id,
        contactName: client.name,
        phoneNumber: client.phoneE164,
        status: "scheduled" as const,
        scheduledAt: now,
      }));

    if (messageValues.length > 0) {
      await db.insert(whatsappCampaignMessages).values(messageValues).onConflictDoNothing();
    }
    */

    await db
      .update(whatsappCampaigns)
      .set({
        totalContacts: queued + suppressedDuplicate + preSuppressed.length,
        scheduledMessages: queued,
        status: queued === 0 ? "completed" : isScheduled ? "created" : "in_progress",
        completedAt: queued === 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaignId));

    // 5. NÃO dispara inline — apenas enfileira. O job whatsapp-campaign-dispatcher
    //    processa as mensagens "scheduled" em lotes (evita timeout em disparo em massa).
    const responseBody = {
      campaignId,
      queued,
      suppressedDuplicate,
      skippedNoPhone: skippedInvalidPhone,
      skippedDuplicatePhone,
      skippedOptedOut,
      skippedAlreadyQueued: alreadyQueuedIds.size,
      conflicts,
      scheduledAt: isScheduled ? scheduledDate?.toISOString() : null,
    };
    if (queued === 0) {
      return res.status(409).json({
        ...responseBody,
        message: "Nenhum destinatário elegível permaneceu após a proteção contra duplicidade",
      });
    }
    return res.status(202).json(responseBody);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enfileirar campanha";
    console.error("[WA campaigns] erro:", e);
    res.status(500).json({ message });
  }
});

// ── Reprocessar mensagens com falha ───────────────────────────────────────────
// Reenfileira (failed → scheduled) e marca a campanha como in_progress para que
// o job whatsapp-campaign-dispatcher retente o envio em segundo plano.

router.post("/campaigns/:id/retry-failed", async (req, res) => {
  const campaignId = req.params.id;
  try {
    const failed = await db
      .update(whatsappCampaignMessages)
      .set({ status: "scheduled", errorMessage: null, updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "failed"),
        ),
      )
      .returning({ id: whatsappCampaignMessages.id });

    if (failed.length > 0) {
      await db
        .update(whatsappCampaigns)
        .set({ status: "in_progress", completedAt: null, updatedAt: new Date() })
        .where(eq(whatsappCampaigns.id, campaignId));
    }

    res.json({ campaignId, requeued: failed.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao reprocessar falhas";
    res.status(500).json({ message });
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
    await db
      .update(whatsappCampaigns)
      .set({ status: "paused", updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaigns.id, req.params.id),
          inArray(whatsappCampaigns.status, ["in_progress", "created"]),
        ),
      );
    res.json({ campaignId: req.params.id, status: "paused" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao pausar campanha";
    res.status(500).json({ message });
  }
});

router.post("/campaigns/:id/resume", async (req, res) => {
  try {
    await db
      .update(whatsappCampaigns)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaigns.id, req.params.id),
          eq(whatsappCampaigns.status, "paused"),
        ),
      );
    res.json({ campaignId: req.params.id, status: "in_progress" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao retomar campanha";
    res.status(500).json({ message });
  }
});

router.post("/campaigns/:id/cancel", async (req, res) => {
  const campaignId = req.params.id;
  try {
    // Cancela as mensagens ainda na fila e a campanha.
    const cancelled = await db
      .update(whatsappCampaignMessages)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "scheduled"),
        ),
      )
      .returning({ id: whatsappCampaignMessages.id });

    if (cancelled.length > 0) {
      await db
        .update(whatsappCampaignImpacts)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(inArray(whatsappCampaignImpacts.campaignMessageId, cancelled.map((item) => item.id)));
    }

    await db
      .update(whatsappCampaigns)
      .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, campaignId));

    res.json({ campaignId, cancelledMessages: cancelled.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao cancelar campanha";
    res.status(500).json({ message });
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
