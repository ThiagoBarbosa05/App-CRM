import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar transações de cashback
 *
 * @route GET /api/cashback-transactions
 * @access Private
 *
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header)
 *
 * @returns {Array} Lista de transações de cashback com informações do cliente
 *
 * @description
 * Retorna lista de transações de cashback.
 * Filtra por usuário se role não for admin/administrador.
 * Inclui informações do cliente associado a cada transação.
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "transaction-id",
 *     "clientId": "client-id",
 *     "amount": "50.00",
 *     "type": "earned",
 *     "status": "approved",
 *     "settingId": "setting-id",
 *     "expiresAt": "2026-01-22T23:59:59.000Z",
 *     "createdAt": "2025-12-25T10:00:00.000Z",
 *     "client": {
 *       "id": "client-id",
 *       "name": "João Silva",
 *       "phone": "(11) 98765-4321"
 *     }
 *   }
 * ]
 */
export const getCashbackTransactionsListController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId =
      (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole =
      (req.query.userRole as string) || (req.headers["x-user-role"] as string);

    const transactions = await storage.getCashbackTransactions(
      userId,
      userRole
    );
    res.json(transactions);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    res.status(500).json({ message: "Erro ao buscar transações" });
  }
};
