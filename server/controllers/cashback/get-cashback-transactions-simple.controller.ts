import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

/**
 * Controller para buscar transações de cashback (rota simples)
 *
 * @route GET /api/cashback-settings/transactions-simple
 *
 * @queryparam {string} [userId] - ID do usuário (via query ou header x-user-id)
 * @queryparam {string} [userRole] - Role do usuário (via query ou header x-user-role)
 *
 * @returns {Array} Lista de transações de cashback com dados do cliente e responsável
 *
 * @example
 * GET /api/cashback-settings/transactions-simple
 * GET /api/cashback-settings/transactions-simple?userId=user-123&userRole=vendedor
 *
 * @example Response
 * [
 *   {
 *     "id": "trans-123",
 *     "clientId": "client-456",
 *     "dealId": "deal-789",
 *     "purchaseAmount": "1000.00",
 *     "cashbackAmount": "100.00",
 *     "cashbackRate": "10.00",
 *     "status": "approved",
 *     "expiresAt": "2024-02-15T00:00:00.000Z",
 *     "processedBy": "user-111",
 *     "settingId": "setting-222",
 *     "notes": "Cashback gerado automaticamente",
 *     "createdAt": "2024-01-15T10:30:00.000Z",
 *     "updatedAt": "2024-01-15T10:30:00.000Z",
 *     "clientName": "João Silva",
 *     "clientEmail": "joao@example.com",
 *     "responsibleId": "user-333",
 *     "responsibleName": "Maria Santos"
 *   }
 * ]
 *
 * @implementation
 * - Se userRole for "vendedor", retorna apenas transações de clientes sob responsabilidade do userId
 * - Faz join com clients e users para trazer dados completos
 * - Ordenado por data de criação
 */
export async function getCashbackTransactionsSimple(
  req: Request,
  res: Response
) {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    const transactions =
      await cashbackStatisticsService.getCashbackTransactions(userId, userRole);

    res.json(transactions);
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    res.status(500).json({ message: "Erro ao buscar transações" });
  }
}
