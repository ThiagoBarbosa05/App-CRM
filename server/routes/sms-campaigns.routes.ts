import { Router } from "express";
import { validateBody } from "../middleware/validation";
import { insertSmsCampaignSchema } from "@shared/schema";
import {
  listSmsCampaignsController,
  getSmsCampaignController,
  createSmsCampaignController,
  sendSmsCampaignController,
  deleteSmsCampaignController,
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
smsCampaignsRouter.post("/send-individual", async (req, res) => {
  const { to, message } = req.body as { to?: string; message?: string };
  if (!to || !message?.trim()) {
    return res.status(400).json({ message: "Destinatário e mensagem são obrigatórios" });
  }
  try {
    const { sendSms } = await import("../integrations/sms");
    const result = await sendSms({ to, body: message.trim() });
    return res.json({ ok: true, sid: result.sid });
  } catch (err: any) {
    return res.status(502).json({ message: err.message ?? "Erro ao enviar SMS" });
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
 * @description Resolve destinatários e enfileira o envio da campanha (processado pelo dispatcher)
 * @access Private
 */
smsCampaignsRouter.post("/:id/send", sendSmsCampaignController);

/**
 * @route DELETE /api/sms-campaigns/:id
 * @description Remove uma campanha de SMS
 * @access Private
 */
smsCampaignsRouter.delete("/:id", deleteSmsCampaignController);
