import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route GET /api/user-goals/:userId
 * @description Busca a meta de um usuário específico pelo ID do usuário
 * @access Private
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} Retorna a meta do usuário ou null se não existir
 *
 * @example
 * GET /api/user-goals/123e4567-e89b-12d3-a456-426614174000
 * Response:
 * {
 *   "id": "456e7890-e89b-12d3-a456-426614174000",
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "monthlyGoal": 50000,
 *   "salesGoal": 100,
 *   ...
 * }
 *
 * @notes
 * - Requer autenticação do usuário
 * - Retorna null se o usuário não tiver meta cadastrada
 * - Utiliza getUserGoalByUserId do storage para buscar a meta específica
 * - Errors are logged to the console for debugging
 *
 * @throws {500} Erro ao buscar meta do usuário
 */
export const getUserGoalByIdController = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = req.params;
    const goal = await storage.getUserGoalByUserId(userId);
    res.json(goal);
  } catch (error) {
    console.error("Erro ao buscar meta do usuário:", error);
    res.status(500).json({ message: "Erro ao buscar meta" });
  }
};
