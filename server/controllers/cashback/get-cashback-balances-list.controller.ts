import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar todos os saldos de cashback
 *
 * @route GET /api/cashback-balances
 * @access Private
 *
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header)
 *
 * @returns {Array} Lista de saldos de cashback com informações do cliente
 *
 * @description
 * Retorna lista de saldos de cashback de todos os clientes.
 * Filtra por usuário se role não for admin/administrador.
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "balance-id",
 *     "clientId": "client-id",
 *     "currentBalance": "150.00",
 *     "totalEarned": "500.00",
 *     "totalUsed": "350.00",
 *     "client": {
 *       "id": "client-id",
 *       "name": "João Silva",
 *       "phone": "(11) 98765-4321"
 *     }
 *   }
 * ]
 */
export const getCashbackBalancesListController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const balances = await storage.getAllCashbackBalances(userId, userRole);
    res.json(balances);
  } catch (error) {
    console.error("Erro ao buscar saldos:", error);
    res.status(500).json({ message: "Erro ao buscar saldos" });
  }
};
