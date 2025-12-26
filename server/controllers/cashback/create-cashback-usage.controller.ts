import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para criar registro de uso de cashback
 *
 * @route POST /api/cashback-usage
 * @access Private
 *
 * @bodyParams {string} clientId - UUID do cliente (obrigatório)
 * @bodyParams {string} amountUsed - Valor utilizado (obrigatório)
 * @bodyParams {string} [saleId] - UUID da venda (opcional)
 *
 * @returns {Object} Registro de uso de cashback criado
 *
 * @description
 * Cria um novo registro de uso de cashback.
 * Atualiza automaticamente o saldo do cliente.
 *
 * @example Request Body
 * {
 *   "clientId": "client-id",
 *   "amountUsed": "50.00",
 *   "saleId": "sale-id"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "usage-id",
 *   "clientId": "client-id",
 *   "amountUsed": "50.00",
 *   "saleId": "sale-id",
 *   "usedAt": "2025-12-25T10:00:00.000Z"
 * }
 */
export const createCashbackUsageController = async (
  req: Request,
  res: Response
) => {
  try {
    const usageData = req.body;
    const usage = await storage.createCashbackUsage(usageData);
    res.status(201).json(usage);
  } catch (error) {
    console.error("Erro ao criar uso de cashback:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
