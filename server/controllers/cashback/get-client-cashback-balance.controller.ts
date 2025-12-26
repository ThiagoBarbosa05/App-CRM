import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar saldo de cashback de um cliente específico
 *
 * @route GET /api/cashback-balances/:clientId
 * @access Private
 *
 * @pathParams {string} clientId - UUID do cliente
 *
 * @returns {Object} Saldo de cashback do cliente
 *
 * @description
 * Retorna o saldo de cashback de um cliente específico.
 * Se não existir registro, cria um novo com saldo zero.
 *
 * @example Success Response (200)
 * {
 *   "id": "balance-id",
 *   "clientId": "client-id",
 *   "currentBalance": "150.00",
 *   "totalEarned": "500.00",
 *   "totalUsed": "350.00",
 *   "updatedAt": "2025-12-25T10:30:00.000Z"
 * }
 *
 * @example Success Response (200) - Novo saldo criado
 * {
 *   "currentBalance": "0.00"
 * }
 */
export const getClientCashbackBalanceController = async (
  req: Request,
  res: Response
) => {
  try {
    const { clientId } = req.params;
    const clientBalance = await storage.getClientCashbackBalance(clientId);

    if (clientBalance) {
      res.json(clientBalance);
    } else {
      // Se não existe registro, criar um com saldo zero
      await storage.updateClientCashbackBalance(clientId);
      const newBalance = await storage.getClientCashbackBalance(clientId);
      res.json(newBalance || { currentBalance: "0.00" });
    }
  } catch (error) {
    console.error("Erro ao buscar saldo de cashback:", error);
    res.status(500).json({ message: "Erro ao buscar saldo de cashback" });
  }
};
