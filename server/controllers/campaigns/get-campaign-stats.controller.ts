import { Request, Response } from "express";
import { getCampaignStats } from "./campaign-logger";

/**
 * Controller para buscar estatísticas de uma campanha
 * GET /api/umbler/campaigns/:id/stats
 */
export async function getCampaignStatsController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "ID da campanha é obrigatório",
      });
    }

    const stats = await getCampaignStats(id);

    if (!stats) {
      return res.status(404).json({
        error: "Campanha não encontrada ou erro ao buscar estatísticas",
      });
    }

    return res.status(200).json({
      campaignId: id,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in getCampaignStatsController:", error);
    return res.status(500).json({
      error: "Erro ao buscar estatísticas da campanha",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
