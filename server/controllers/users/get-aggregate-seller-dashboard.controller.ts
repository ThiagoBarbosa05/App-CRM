import { Request, Response } from "express";
import { getAggregateDashboard } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/seller-dashboard/aggregate
 * Retorna métricas agregadas de todos os vendedores para admin/gerente.
 */
export async function getAggregateSellerDashboardController(_req: Request, res: Response) {
  try {
    const data = await getAggregateDashboard();
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateSellerDashboardController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
