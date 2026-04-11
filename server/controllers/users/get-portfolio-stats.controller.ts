import { Request, Response } from "express";
import { getPortfolioStatsData } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/seller-dashboard/portfolio-stats
 * Retorna estatísticas de carteira por vendedor e novos clientes no período.
 * Filtra por vendedor quando userId é informado.
 */
export async function getPortfolioStatsController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate   = typeof req.query.endDate   === "string" ? req.query.endDate   : undefined;
    const userId    = typeof req.query.userId    === "string" ? req.query.userId    : undefined;

    const data = await getPortfolioStatsData(startDate, endDate, userId);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getPortfolioStatsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
