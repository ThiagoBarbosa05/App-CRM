import { Request, Response } from "express";
import { getWinePriceTierItems } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/seller-dashboard/wine-tier-items
 * Retorna os itens individuais de uma faixa de preço para um vendedor.
 */
export async function getWineTierItemsController(req: Request, res: Response) {
  try {
    const { sellerId, startDate, endDate, tier } = req.query;

    if (
      typeof sellerId !== "string" ||
      typeof startDate !== "string" ||
      typeof endDate !== "string" ||
      (tier !== "economico" && tier !== "intermediario" && tier !== "premium")
    ) {
      return res.status(400).json({ success: false, error: "Parâmetros inválidos" });
    }

    const items = await getWinePriceTierItems(sellerId, startDate, endDate, tier);
    return res.json({ success: true, items });
  } catch (error) {
    console.error("[getWineTierItemsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
