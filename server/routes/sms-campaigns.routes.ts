import { Router } from "express";
import { validateBody } from "../middleware/validation";
import { rateLimit } from "../middleware/rate-limit";
import { insertSmsCampaignSchema, sendIndividualSmsSchema } from "@shared/schema";
import {
  listSmsCampaignsController,
  getSmsCampaignController,
  createSmsCampaignController,
  sendSmsCampaignController,
  deleteSmsCampaignController,
  sendIndividualSmsController,
} from "../controllers/marketing/sms-campaigns.controller";

export const smsCampaignsRouter = Router();

const createSmsCampaignBodySchema = insertSmsCampaignSchema.omit({
  createdBy: true,
});

/**
 * @route GET /api/sms-campaigns
 * @description Lista campanhas de SMS
 * @access Private
 */
smsCampaignsRouter.get("/", listSmsCampaignsController);

/**
 * @route GET /api/sms-campaigns/balance
 * @description Consulta o saldo da conta Twilio
 * @access Private
 */
smsCampaignsRouter.get("/balance", async (_req, res) => {
  try {
    const { getTwilioConfig } = await import("../lib/twilio-config");
    const { accountSid, authToken } = await getTwilioConfig();
    if (!accountSid || !authToken) {
      return res.status(503).json({ message: "Twilio não configurado" });
    }
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    const balance = await client.balance.fetch();
    return res.json({ balance: balance.balance, currency: balance.currency });
  } catch (err: any) {
    return res.status(502).json({ message: err.message ?? "Erro ao consultar saldo" });
  }
});

/**
 * @route POST /api/sms-campaigns/send-individual
 * @description Envia SMS avulso para um número ou cliente específico
 * @access Private
 */
smsCampaignsRouter.post(
  "/send-individual",
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    keyFn: (req) => `sms-individual:${req.user?.userId ?? req.ip}`,
    message: "Muitos envios individuais em pouco tempo. Aguarde alguns minutos.",
  }),
  validateBody(sendIndividualSmsSchema),
  sendIndividualSmsController,
);

/**
 * @route GET /api/sms-campaigns/preview-count
 * @description Retorna quantos clientes correspondem ao filtro de targeting (sem criar campanha)
 * @access Private
 */
smsCampaignsRouter.get("/preview-count", async (req, res) => {
  try {
    const { resolveTargetClients } = await import("../services/marketing-targeting.service");
    const targetType = (req.query.targetType as string) || "all";
    const targetCriteria = (req.query.targetCriteria as string) || null;
    const targets = await resolveTargetClients(targetType as any, targetCriteria || null);
    const withPhone = targets.filter((c) => c.phone && c.phone.trim() !== "").length;
    return res.json({ total: targets.length, withPhone });
  } catch (err: any) {
    return res.status(500).json({ message: err.message ?? "Erro ao calcular preview" });
  }
});

/**
 * @route GET /api/sms-campaigns/:id
 * @description Busca uma campanha de SMS com seus destinatários
 * @access Private
 */
smsCampaignsRouter.get("/:id", getSmsCampaignController);

/**
 * @route POST /api/sms-campaigns
 * @description Cria uma campanha de SMS (status draft)
 * @access Private
 */
smsCampaignsRouter.post(
  "/",
  validateBody(createSmsCampaignBodySchema),
  createSmsCampaignController,
);

/**
 * @route POST /api/sms-campaigns/:id/send
 * @description Resolve destinatários e enfileira o envio imediato da campanha
 * @access Private
 */
smsCampaignsRouter.post("/:id/send", sendSmsCampaignController);

/**
 * @route POST /api/sms-campaigns/:id/schedule
 * @description Agenda a campanha para envio em data/hora específica
 * @access Private
 */
smsCampaignsRouter.post("/:id/schedule", async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ message: "Data de agendamento obrigatória" });
    }
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({ message: "Data de agendamento deve ser no futuro" });
    }
    const { queueCampaignForSend } = await import("../services/sms-campaign.service");
    const campaign = await queueCampaignForSend(req.params.id, date);
    return res.json(campaign);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : "Erro ao agendar campanha";
    return res.status(400).json({ message });
  }
});

/**
 * @route DELETE /api/sms-campaigns/:id
 * @description Remove uma campanha de SMS
 * @access Private
 */
smsCampaignsRouter.delete("/:id", deleteSmsCampaignController);
