import { Request, Response } from "express";
import * as smsCampaignService from "../../services/sms-campaign.service";

export async function listSmsCampaignsController(req: Request, res: Response) {
  try {
    const campaigns = await smsCampaignService.listCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error("Erro ao listar campanhas de SMS:", error);
    res.status(500).json({ message: "Erro ao listar campanhas de SMS" });
  }
}

export async function getSmsCampaignController(req: Request, res: Response) {
  try {
    const campaign = await smsCampaignService.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    res.json(campaign);
  } catch (error) {
    console.error("Erro ao buscar campanha de SMS:", error);
    res.status(500).json({ message: "Erro ao buscar campanha de SMS" });
  }
}

export async function createSmsCampaignController(req: Request, res: Response) {
  try {
    const campaign = await smsCampaignService.createCampaign({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Erro ao criar campanha de SMS:", error);
    res.status(500).json({ message: "Erro ao criar campanha de SMS" });
  }
}

export async function sendSmsCampaignController(req: Request, res: Response) {
  try {
    const campaign = await smsCampaignService.queueCampaignForSend(req.params.id);
    res.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar campanha de SMS";
    console.error("Erro ao enviar campanha de SMS:", error);
    res.status(400).json({ message });
  }
}

export async function deleteSmsCampaignController(req: Request, res: Response) {
  try {
    const deleted = await smsCampaignService.deleteCampaign(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Campanha não encontrada" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir campanha de SMS:", error);
    res.status(500).json({ message: "Erro ao excluir campanha de SMS" });
  }
}
