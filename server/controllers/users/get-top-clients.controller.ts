import { Request, Response } from "express";
import { getTopClientsData } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/seller-dashboard/top-clients
 * Retorna top clientes por valor total, ticket médio e valor médio por item.
 * Filtra por vendedor quando userId é informado.
 */
export async function getTopClientsController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate   = typeof req.query.endDate   === "string" ? req.query.endDate   : undefined;
    const userId    = typeof req.query.userId    === "string" ? req.query.userId    : undefined;

    const data = await getTopClientsData(startDate, endDate, userId);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getTopClientsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
