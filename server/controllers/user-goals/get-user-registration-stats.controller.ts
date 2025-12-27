import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route GET /api/user-registration-stats
 * @description Busca estatísticas de cadastro de usuários
 * @access Private
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} Retorna as estatísticas calculadas pelo storage
 *
 * @example
 * GET /api/user-registration-stats
 * Response:
 * {
 *   "total": 123,
 *   "byMonth": [{ "month": 12, "year": 2025, "count": 10 }]
 * }
 *
 * @notes
 * - Requer autenticação do usuário
 * - Mantém o mesmo comportamento da rota monolítica
 * - Errors are logged to the console for debugging
 *
 * @throws {500} Erro ao buscar estatísticas de cadastro
 */
export const getUserRegistrationStatsController = async (
  req: Request,
  res: Response
) => {
  try {
    const stats = await storage.getUserRegistrationStats();
    res.json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas de cadastro:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar estatísticas de cadastro" });
  }
};
