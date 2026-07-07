import { Request, Response } from "express";
import * as smsCampaignService from "../../services/sms-campaign.service";
import { SmsApiError } from "../../integrations/sms";
import type { SendIndividualSmsInput } from "@shared/schema";

export async function listSmsCampaignsController(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await smsCampaignService.listCampaigns(page, pageSize);
    res.json(result);
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

export async function sendIndividualSmsController(req: Request, res: Response) {
  try {
    const { to, message, clientId } = req.body as SendIndividualSmsInput;
    const result = await smsCampaignService.sendIndividualSms({
      to,
      message,
      clientId,
      sentBy: req.user!.userId,
    });
    res.json({ ok: true, sid: result.twilioSid });
  } catch (error) {
    const status = error instanceof SmsApiError ? 502 : 500;
    const message = error instanceof Error ? error.message : "Erro ao enviar SMS";
    console.error("Erro ao enviar SMS individual:", error);
    res.status(status).json({ message });
  }
}
