import { Request, Response } from "express";
import { getInactiveClientsData } from "../../services/seller-dashboard.service";

/**
 * GET /api/users/seller-dashboard/inactive-clients
 * Retorna clientes sem compra há X dias (configurado em purchase_status_days).
 * Filtra por vendedor quando userId é informado.
 */
export async function getInactiveClientsController(req: Request, res: Response) {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    const data = await getInactiveClientsData(userId);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getInactiveClientsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
