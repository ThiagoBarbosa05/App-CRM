import { Router } from "express";
import { getWeeklyResultsController } from "../controllers/weekly-results/get-weekly-results.controller";
import { getWeeklyResultsByGoalIdController } from "../controllers/weekly-results/get-weekly-results-by-goal-id.controller";
import { postWeeklyResultsController } from "../controllers/weekly-results/post-weekly-results.controller";
import { putWeeklyResultsController } from "../controllers/weekly-results/put-weekly-results.controller";
import { deleteWeeklyResultsController } from "../controllers/weekly-results/delete-weekly-results.controller";

/**
 * Router específico para endpoints relacionados a resultados semanais.
 * Montado em /api/weekly-results
 */
const weeklyResultsRouter = Router();

/**
 * @route GET /api/weekly-results
 * @description Busca todos os resultados semanais
 */
weeklyResultsRouter.get("/", getWeeklyResultsController);

/**
 * @route POST /api/weekly-results
 * @description Cria/atualiza resultado semanal (por goalId+week)
 */
weeklyResultsRouter.post("/", postWeeklyResultsController);

/**
 * @route PUT /api/weekly-results/:id
 * @description Atualiza um resultado semanal pelo ID
 */
weeklyResultsRouter.put("/:id", putWeeklyResultsController);

/**
 * @route DELETE /api/weekly-results/:id
 * @description Exclui um resultado semanal pelo ID
 */
weeklyResultsRouter.delete("/:id", deleteWeeklyResultsController);

/**
 * @route GET /api/weekly-results/:goalId
 * @description Busca resultados semanais por ID da meta
 */
weeklyResultsRouter.get("/:goalId", getWeeklyResultsByGoalIdController);

export default weeklyResultsRouter;
