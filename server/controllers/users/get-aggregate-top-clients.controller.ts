import { Request, Response } from "express";
import { getAggregateTopClientsData } from "../../services/seller-dashboard.service";
import { clientsService } from "../../services/clients.service";

export async function getAggregateTopClientsController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const filterUserId =
      typeof req.query.filterUserId === "string" ? req.query.filterUserId : undefined;
    const { userId, userRole, filters } = clientsService.processRequestParams(req);

    const data = await getAggregateTopClientsData(startDate, endDate, {
      requestUserId: userId,
      requestUserRole: userRole,
      filterUserId,
      filters,
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateTopClientsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
