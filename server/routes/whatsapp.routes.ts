import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  campaigns,
  clients,
  whatsappCampaigns,
  whatsappCampaignMessages,
} from "@shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { sendTextMessage, sendTemplateMessage } from "../integrations/whatsapp";
import {
  listCampaigns,
  getCampaignDetails,
  getCampaignStats,
  getCampaignBotStats,
} from "../controllers/campaigns/campaign-logger";
import { formatPhoneToDigits } from "../lib/format-phone";

const router = Router();

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

router.post("/campaigns", async (req, res) => {
  const schema = z.object({
    campaignId: z.string().uuid(),
    clientIds: z.array(z.string()).min(1),
    scheduledAt: z.string().datetime().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }

  const { campaignId, clientIds, scheduledAt } = parsed.data;

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

    // 2. Buscar clientes
    const clientRows = await db
      .select({ id: clients.id, name: clients.name, phone: clients.phone })
      .from(clients)
      .where(inArray(clients.id, clientIds));

    const validClients = clientRows.filter((c) => c.phone?.trim());

    if (validClients.length === 0) {
      return res.status(400).json({ message: "Nenhum dos clientes fornecidos possui telefone válido" });
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
      })
      .onConflictDoUpdate({
        target: whatsappCampaigns.id,
        set: {
          status: isScheduled ? "created" : "in_progress",
          totalContacts: validClients.length,
          scheduledMessages: validClients.length,
          startDate: scheduledDate ?? new Date(),
          updatedAt: new Date(),
        },
      });

    // 4. Criar mensagens agendadas em whatsappCampaignMessages
    const now = new Date();
    const messageValues = validClients.map((client) => ({
      id: `${campaignId}-${client.id}-${now.getTime()}`,
      campaignId,
      contactId: client.id,
      contactName: client.name,
      phoneNumber: formatPhoneToDigits(client.phone!),
      status: "scheduled" as const,
      scheduledAt: now,
    }));

    await db.insert(whatsappCampaignMessages).values(messageValues).onConflictDoNothing();

    // 5. NÃO dispara inline — apenas enfileira. O job whatsapp-campaign-dispatcher
    //    processa as mensagens "scheduled" em lotes (evita timeout em disparo em massa).
    res.status(202).json({
      campaignId,
      queued: validClients.length,
      skippedNoPhone: clientRows.length - validClients.length,
      scheduledAt: isScheduled ? scheduledDate?.toISOString() : null,
    });
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

export default router;
