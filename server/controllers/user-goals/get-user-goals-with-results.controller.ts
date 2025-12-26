import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route GET /api/user-goals-with-results/:month/:year
 * @description Busca todas as metas de usuários com os resultados alcançados para um mês/ano específico
 * @access Private
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {string} req.params.month - Mês (1-12)
 * @param {string} req.params.year - Ano (ex: 2025)
 *
 * @returns {Promise<void>} Retorna array de metas com resultados calculados
 *
 * @example
 * GET /api/user-goals-with-results/12/2025
 * Response:
 * [
 *   {
 *     "id": "goal-123",
 *     "userId": "user-456",
 *     "monthlyGoal": 50000,
 *     "month": 12,
 *     "year": 2025,
 *     "results": {
 *       "totalSales": 45000,
 *       "achievement": 90,
 *       "clientsRegistered": 15
 *     }
 *   }
 * ]
 *
 * @notes
 * - Requer autenticação do usuário
 * - Os parâmetros month e year são convertidos para números
 * - Retorna metas combinadas com os resultados reais do período
 * - Útil para dashboards e relatórios de desempenho
 * - Errors are logged to the console for debugging
 *
 * @throws {500} Erro ao buscar metas com resultados
 */
export const getUserGoalsWithResultsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { month, year } = req.params;
    const goals = await storage.getUserGoalsWithResults(
      Number(month),
      Number(year)
    );
    res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas com resultados:", error);
    res.status(500).json({ message: "Erro ao buscar metas com resultados" });
  }
};
