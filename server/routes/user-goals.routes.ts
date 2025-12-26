import { Router } from "express";
import {
  getUserGoalsController,
  getUserGoalByIdController,
  getUserGoalsWithResultsController,
} from "../controllers/user-goals/index";

/**
 * Router específico para endpoints relacionados a metas de usuários
 * Gerencia metas mensais e resultados de desempenho
 */
const userGoalsRouter = Router();

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
 *   }
 * ]
 *
 * @notes
 * - Retorna todas as metas cadastradas no sistema
 * - Usado para visualização geral de metas por administradores
 */
userGoalsRouter.get("/", getUserGoalsController);

/**
 * @route GET /api/user-goals/:userId
 * @description Busca a meta de um usuário específico pelo ID do usuário
 * @access Private (requer autenticação)
 * @param {string} userId - ID do usuário
 * @returns {Object|null} Meta do usuário ou null se não existir
 *
 * @example Request
 * GET /api/user-goals/123e4567-e89b-12d3-a456-426614174000
 *
 * @example Success Response (200)
 * {
 *   "id": "goal-123",
 *   "userId": "123e4567-e89b-12d3-a456-426614174000",
 *   "monthlyGoal": 50000,
 *   "salesGoal": 100,
 *   "createdAt": "2025-01-01T10:00:00.000Z"
 * }
 *
 * @notes
 * - Retorna null se o usuário não tiver meta cadastrada
 * - Utilizado para visualizar meta específica de um usuário
 */
userGoalsRouter.get("/:userId", getUserGoalByIdController);

export default userGoalsRouter;

/**
 * Router separado para rota user-goals-with-results
 * Necessário porque o caminho contém hífen e não é subroute de user-goals
 */
const userGoalsWithResultsRouter = Router();

/**
 * @route GET /api/user-goals-with-results/:month/:year
 * @description Busca todas as metas com resultados para um mês/ano específico
 * @access Private (requer autenticação)
 * @param {string} month - Mês (1-12)
 * @param {string} year - Ano (ex: 2025)
 * @returns {Array} Metas com resultados calculados do período
 *
 * @example Request
 * GET /api/user-goals-with-results/12/2025
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "goal-123",
 *     "userId": "user-456",
 *     "monthlyGoal": 50000,
 *     "results": {
 *       "totalSales": 45000,
 *       "achievement": 90
 *     }
 *   }
 * ]
 *
 * @notes
 * - Combina metas com resultados reais do período
 * - Usado para dashboards e relatórios de performance
 */
userGoalsWithResultsRouter.get(
  "/:month/:year",
  getUserGoalsWithResultsController
);

export { userGoalsWithResultsRouter };
