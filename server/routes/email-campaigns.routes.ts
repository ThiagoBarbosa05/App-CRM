import { Router } from "express";
import { validateBody } from "../middleware/validation";
import { insertEmailCampaignSchema } from "@shared/schema";
import {
  listEmailCampaignsController,
  getEmailCampaignController,
  createEmailCampaignController,
  sendEmailCampaignController,
  deleteEmailCampaignController,
} from "../controllers/marketing/email-campaigns.controller";

export const emailCampaignsRouter = Router();

const createEmailCampaignBodySchema = insertEmailCampaignSchema.omit({
  createdBy: true,
});

/**
 * @route GET /api/email-campaigns
 * @description Lista campanhas de email
 * @access Private
 */
emailCampaignsRouter.get("/", listEmailCampaignsController);

/**
 * @route GET /api/email-campaigns/:id
 * @description Busca uma campanha de email com seus destinatários
 * @access Private
 */
emailCampaignsRouter.get("/:id", getEmailCampaignController);

/**
 * @route POST /api/email-campaigns
 * @description Cria uma campanha de email (status draft)
 * @access Private
 */
emailCampaignsRouter.post(
  "/",
  validateBody(createEmailCampaignBodySchema),
  createEmailCampaignController,
);

/**
 * @route POST /api/email-campaigns/:id/send
 * @description Resolve destinatários e enfileira o envio da campanha (processado pelo dispatcher)
 * @access Private
 */
emailCampaignsRouter.post("/:id/send", sendEmailCampaignController);

/**
 * @route POST /api/email-campaigns/:id/schedule
 * @description Agenda a campanha para envio em data/hora específica
 * @access Private
 */
emailCampaignsRouter.post("/:id/schedule", async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) {
      return res.status(400).json({ message: "Data de agendamento obrigatória" });
    }
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({ message: "Data de agendamento deve ser no futuro" });
    }
    const { queueCampaignForSend } = await import("../services/email-campaign.service");
    const campaign = await queueCampaignForSend(req.params.id, date);
    return res.json(campaign);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao agendar campanha";
    return res.status(400).json({ message });
  }
});

/**
 * @route DELETE /api/email-campaigns/:id
 * @description Remove uma campanha de email
 * @access Private
 */
emailCampaignsRouter.delete("/:id", deleteEmailCampaignController);
