import { Request, Response } from "express";
import { getAggregateDashboard, getSellerDashboard } from "../../services/seller-dashboard.service";
import { storage } from "../../storage";

/**
 * GET /api/users/seller-dashboard/aggregate
 * Retorna métricas agregadas de todos os vendedores para admin/gerente.
 * Se userId for passado como query param, filtra para esse vendedor específico.
 */
export async function getAggregateSellerDashboardController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    if (userId) {
      // Admin selected a specific seller — use per-seller dashboard
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "Usuário não encontrado" });
      }
      const data = await getSellerDashboard(userId, user.blingVendedorId ?? null, startDate, endDate);
      // Map to aggregate-compatible shape
      return res.json({
        success: true,
        topClients: data.topClients,
        highestAvgTicket: data.highestAvgTicket,
        highestAvgItemValue: data.highestAvgItemValue,
        inactiveClients: data.inactiveClients,
        newClientsThisMonth: data.newClientsThisMonth,
        sellerPortfolioStats: [{
          userId,
          sellerName: user.name,
          total: data.portfolioStats.total,
          active: data.portfolioStats.active,
          inactive: data.portfolioStats.inactive,
          positivacao: data.portfolioStats.positivacao,
        }],
        monthlySummary: data.monthlySummary,
        prevMonthSummary: data.prevMonthSummary,
        salesEvolution: data.salesEvolution,
        topProducts: data.topProducts,
        sellerRanking: [],
        sellerWinePriceTiers: data.winePriceTier ? [data.winePriceTier] : [],
        winePriceTierThresholds: data.winePriceTierThresholds,
      });
    }

    const data = await getAggregateDashboard(startDate, endDate);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateSellerDashboardController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
