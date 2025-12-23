/**
 * Controller para buscar execuções de automação
 */

import type { Request, Response } from "express";
import { AutomationExecutionService } from "../../services/automation-execution.service";

/**
 * GET /api/automation/executions
 * Busca todas as execuções (com paginação)
 */
export async function getExecutionsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const result = await AutomationExecutionService.getAllExecutions(
      page,
      pageSize
    );

    res.json(result);
  } catch (error) {
    console.error("[Get Executions Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao buscar execuções",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/automation/executions/running
 * Busca execuções em andamento
 */
export async function getRunningExecutionsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const executions = await AutomationExecutionService.getRunningExecutions();

    res.json({
      count: executions.length,
      executions,
    });
  } catch (error) {
    console.error("[Get Running Executions Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao buscar execuções em andamento",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/automation/executions/history/:automationId
 * Busca histórico de execuções de uma automação específica
 */
export async function getExecutionHistoryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { automationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await AutomationExecutionService.getExecutionHistory(
      automationId,
      limit
    );

    res.json({
      automationId,
      count: history.length,
      executions: history,
    });
  } catch (error) {
    console.error("[Get Execution History Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao buscar histórico de execuções",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
