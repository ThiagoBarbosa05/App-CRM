import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar todo o histórico de uso de cashback
 *
 * @route GET /api/cashback-usage
 * @access Private
 *
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header)
 *
 * @returns {Array} Lista de usos de cashback
 *
 * @description
 * Retorna histórico de uso de cashback de todos os clientes.
 * Filtra por usuário se role não for admin/administrador.
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "usage-id",
 *     "clientId": "client-id",
 *     "amountUsed": "50.00",
 *     "saleId": "sale-id",
 *     "usedAt": "2025-12-25T10:00:00.000Z"
 *   }
 * ]
 */
export const getCashbackUsageListController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const usage = await storage.getAllCashbackUsage(userId, userRole);
    res.json(usage);
  } catch (error) {
    console.error("Erro ao buscar histórico de uso:", error);
    res.status(500).json({ message: "Erro ao buscar histórico" });
  }
};
