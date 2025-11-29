import { Request, Response } from "express";
import { getCampaignDetails } from "./campaign-logger";

/**
 * Controller para buscar detalhes de uma campanha
 * GET /api/umbler/campaigns/:id
 */
export async function getCampaignDetailsController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "ID da campanha é obrigatório",
      });
    }

    const campaign = await getCampaignDetails(id);

    if (!campaign) {
      return res.status(404).json({
        error: "Campanha não encontrada",
      });
    }

    return res.status(200).json(campaign);
  } catch (error) {
    console.error("Error in getCampaignDetailsController:", error);
    return res.status(500).json({
      error: "Erro ao buscar detalhes da campanha",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
