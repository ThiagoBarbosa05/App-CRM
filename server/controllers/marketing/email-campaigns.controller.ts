import { Request, Response } from "express";
import * as emailCampaignService from "../../services/email-campaign.service";

export async function listEmailCampaignsController(req: Request, res: Response) {
  try {
    const campaigns = await emailCampaignService.listCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error("Erro ao listar campanhas de email:", error);
    res.status(500).json({ message: "Erro ao listar campanhas de email" });
  }
}

export async function getEmailCampaignController(req: Request, res: Response) {
  try {
    const campaign = await emailCampaignService.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    res.json(campaign);
  } catch (error) {
    console.error("Erro ao buscar campanha de email:", error);
    res.status(500).json({ message: "Erro ao buscar campanha de email" });
  }
}

export async function createEmailCampaignController(req: Request, res: Response) {
  try {
    const campaign = await emailCampaignService.createCampaign({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Erro ao criar campanha de email:", error);
    res.status(500).json({ message: "Erro ao criar campanha de email" });
  }
}

export async function sendEmailCampaignController(req: Request, res: Response) {
  try {
    const campaign = await emailCampaignService.queueCampaignForSend(req.params.id);
    res.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar campanha de email";
    console.error("Erro ao enviar campanha de email:", error);
    res.status(400).json({ message });
  }
}

export async function deleteEmailCampaignController(req: Request, res: Response) {
  try {
    const deleted = await emailCampaignService.deleteCampaign(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir campanha de email:", error);
    res.status(500).json({ message: "Erro ao excluir campanha de email" });
  }
}
