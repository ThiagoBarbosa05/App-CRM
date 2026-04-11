import { Request, Response } from "express";
import { getAggregateDashboard } from "../../services/seller-dashboard.service";
import { clientsService } from "../../services/clients.service";

/**
 * GET /api/users/seller-dashboard/aggregate
 * Retorna métricas agregadas de todos os vendedores para admin/gerente.
 * Nota: ignora userId/userRole injetados globalmente pelo queryClient — sempre retorna view agregada.
 */
export async function getAggregateSellerDashboardController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const filterUserId =
      typeof req.query.filterUserId === "string" ? req.query.filterUserId : undefined;
    const { userId, userRole, filters } = clientsService.processRequestParams(req);

    const data = await getAggregateDashboard(startDate, endDate, {
      requestUserId: userId,
      requestUserRole: userRole,
      filterUserId,
      filters,
    });

    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateSellerDashboardController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
