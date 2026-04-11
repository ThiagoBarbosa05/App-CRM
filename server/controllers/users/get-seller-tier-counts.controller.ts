import { Request, Response } from "express";
import { getSellerTierCounts } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/:id/tier-counts?startDate=&endDate=
 * Retorna a contagem de itens por faixa de preço para um vendedor no período.
 */
export async function getSellerTierCountsController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (typeof startDate !== "string" || typeof endDate !== "string") {
      return res.status(400).json({ success: false, error: "startDate e endDate são obrigatórios" });
    }

    const counts = await getSellerTierCounts(id, startDate, endDate);
    return res.json({ success: true, ...counts });
  } catch (error) {
    console.error("[getSellerTierCountsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
