/**
 * Rotas para gerenciamento de execuções de automação
 */

import { Router } from "express";
import {
  cancelAllExecutionsController,
  cancelExecutionController,
} from "server/controllers/automation-execution/cancel-execution.controller";
import {
  executeFullCatchupController,
  getCatchupStatusController,
  startCatchupController,
  stopCatchupController,
} from "server/controllers/automation-execution/catchup.controller";
import {
  getExecutionHistoryController,
  getExecutionsController,
  getRunningExecutionsController,
} from "server/controllers/automation-execution/get-executions.controller";

const router = Router();

// === ROTAS DE CONSULTA ===

/**
 * GET /api/automation/executions
 * Busca todas as execuções (com paginação)
 * Query params: page, pageSize
 */
router.get("/executions", getExecutionsController);

/**
 * GET /api/automation/executions/running
 * Busca execuções em andamento
 */
router.get("/executions/running", getRunningExecutionsController);

/**
 * GET /api/automation/executions/history/:automationId
 * Busca histórico de execuções de uma automação específica
 * Query params: limit
 */
router.get("/executions/history/:automationId", getExecutionHistoryController);

// === ROTAS DE CANCELAMENTO ===

/**
 * POST /api/automation/executions/:executionId/cancel
 * Cancela uma execução específica
 */
router.post("/executions/:executionId/cancel", cancelExecutionController);

/**
 * POST /api/automation/executions/cancel-all
 * Cancela todas as execuções em andamento
 */
router.post("/executions/cancel-all", cancelAllExecutionsController);

// === ROTAS DE CATCH-UP ===

/**
 * GET /api/automation/catchup/status
 * Verifica status do catch-up
 */
router.get("/catchup/status", getCatchupStatusController);

/**
 * POST /api/automation/catchup/start
 * Inicia catch-up das automações do dia
 */
router.post("/catchup/start", startCatchupController);

/**
 * POST /api/automation/catchup/stop
 * Para o catch-up em execução
 */
router.post("/catchup/stop", stopCatchupController);

/**
 * POST /api/automation/catchup/full
 * Executa catch-up completo (últimos 7 dias)
 */
router.post("/catchup/full", executeFullCatchupController);

export default router;
