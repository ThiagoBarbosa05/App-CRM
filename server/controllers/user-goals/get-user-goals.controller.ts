import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route GET /api/user-goals
 * @description Busca todas as metas de usuários
 * @access Private (requer autenticação)
 * @returns {Array} Lista de todas as metas de usuários
 *
 * @example Request
 * GET /api/user-goals
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "goal-123",
 *     "userId": "user-456",
 *     "monthlyGoal": 50000,
 *     "month": 1,
 *     "year": 2025,
 *     "createdAt": "2025-01-01T10:00:00.000Z"
 *   },
 *   {
 *     "id": "goal-124",
 *     "userId": "user-789",
 *     "monthlyGoal": 75000,
 *     "month": 1,
 *     "year": 2025,
 *     "createdAt": "2025-01-01T10:30:00.000Z"
 *   }
 * ]
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao buscar metas"
 * }
 *
 * @notes
 * - Retorna todas as metas cadastradas no sistema
 * - Usado para visualização geral de metas por administradores
 */
export const getUserGoalsController = async (req: Request, res: Response) => {
  try {
    const goals = await storage.getUserGoals();
    res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas:", error);
    res.status(500).json({ message: "Erro ao buscar metas" });
  }
};
