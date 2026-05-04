import { Request, Response } from "express";
import { getAggregatePortfolioData } from "../../services/seller-dashboard.service";
import { clientsService } from "../../services/clients.service";

export async function getAggregatePortfolioController(req: Request, res: Response) {
  try {
    const filterUserId =
      typeof req.query.filterUserId === "string" ? req.query.filterUserId : undefined;
    const { userId, userRole, filters } = clientsService.processRequestParams(req);

    const data = await getAggregatePortfolioData({
      requestUserId: userId,
      requestUserRole: userRole,
      filterUserId,
      filters,
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregatePortfolioController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
