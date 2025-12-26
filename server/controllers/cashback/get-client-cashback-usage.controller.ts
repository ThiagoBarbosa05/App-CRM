import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar histórico de uso de cashback de um cliente
 *
 * @route GET /api/cashback-usage/:clientId
 * @access Private
 *
 * @pathParams {string} clientId - UUID do cliente
 *
 * @returns {Array} Lista de usos de cashback do cliente
 *
 * @description
 * Retorna todo o histórico de uso de cashback de um cliente específico.
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
export const getClientCashbackUsageController = async (
  req: Request,
  res: Response
) => {
  try {
    const { clientId } = req.params;
    const usage = await storage.getClientCashbackUsage(clientId);
    res.json(usage);
  } catch (error) {
    console.error("Erro ao buscar uso de cashback:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
