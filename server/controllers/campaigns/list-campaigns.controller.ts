import { Request, Response } from "express";
import { listCampaigns } from "./campaign-logger";

/**
 * Controller para listar campanhas
 * GET /api/umbler/campaigns
 */
export async function listCampaignsController(req: Request, res: Response) {
  try {
    const { status, limit, offset } = req.query;

    const campaigns = await listCampaigns({
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.status(200).json({
      campaigns,
      total: campaigns.length,
    });
  } catch (error) {
    console.error("Error in listCampaignsController:", error);
    return res.status(500).json({
      error: "Erro ao listar campanhas",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
