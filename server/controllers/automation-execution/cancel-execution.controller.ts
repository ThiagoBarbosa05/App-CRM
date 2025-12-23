/**
 * Controller para cancelar execuções de automação
 */

import type { Request, Response } from "express";
import { AutomationExecutionService } from "../../services/automation-execution.service";

/**
 * POST /api/automation/executions/:executionId/cancel
 * Cancela uma execução específica
 */
export async function cancelExecutionController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { executionId } = req.params;
    const userId = (req.headers["x-user-id"] as string) || undefined;

    const cancelled = await AutomationExecutionService.cancelExecution(
      executionId,
      userId
    );

    if (!cancelled) {
      res.status(404).json({
        message: "Execução não encontrada ou já está finalizada",
      });
      return;
    }

    res.json({
      message: "Execução cancelada com sucesso",
      executionId,
    });
  } catch (error) {
    console.error("[Cancel Execution Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao cancelar execução",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/automation/executions/cancel-all
 * Cancela todas as execuções em andamento
 */
export async function cancelAllExecutionsController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req.headers["x-user-id"] as string) || undefined;

    const count = await AutomationExecutionService.cancelAllRunningExecutions(
      userId
    );

    res.json({
      message: `${count} execução(ões) cancelada(s) com sucesso`,
      count,
    });
  } catch (error) {
    console.error("[Cancel All Executions Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao cancelar execuções",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
