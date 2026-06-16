import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  campaigns,
  clients,
  umblerCampaigns,
  umblerCampaignMessages,
} from "@shared/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { sendTextMessage, sendTemplateMessage } from "../integrations/whatsapp";
import { executeCampaign } from "../services/whatsapp-campaign.service";
import {
  listCampaigns,
  getCampaignDetails,
  getCampaignStats,
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
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Parâmetros inválidos", errors: parsed.error.errors });
  }

  const { campaignId, clientIds } = parsed.data;

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

    // 3. Garantir entrada em umblerCampaigns (satisfaz FK de umblerCampaignMessages)
    await db
      .insert(umblerCampaigns)
      .values({
        id: campaignId,
        title: campaign.name,
        status: "in_progress",
        totalContacts: validClients.length,
        scheduledMessages: validClients.length,
        startDate: new Date(),
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
        target: umblerCampaigns.id,
        set: {
          status: "in_progress",
          totalContacts: validClients.length,
          scheduledMessages: validClients.length,
          updatedAt: new Date(),
        },
      });

    // 4. Criar mensagens agendadas em umblerCampaignMessages
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

    await db.insert(umblerCampaignMessages).values(messageValues).onConflictDoNothing();

    // 5. Executar campanha imediatamente
    const result = await executeCampaign(campaignId);

    // 6. Atualizar status da entrada em umblerCampaigns
    await db
      .update(umblerCampaigns)
      .set({
        status: result.failed === validClients.length ? "failed" : "completed",
        sentMessages: result.sent,
        failedMessages: result.failed,
        updatedAt: new Date(),
      })
      .where(eq(umblerCampaigns.id, campaignId));

    res.status(201).json({
      campaignId,
      totalClients: validClients.length,
      skippedNoPhone: clientRows.length - validClients.length,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao executar campanha";
    console.error("[WA campaigns] erro:", e);
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

export default router;
