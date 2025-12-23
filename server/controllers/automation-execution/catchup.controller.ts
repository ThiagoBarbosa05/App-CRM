/**
 * Controller para gerenciar catch-up de automações
 */

import type { Request, Response } from "express";
import { AutomationExecutionService } from "../../services/automation-execution.service";
import {
  executeTodaysAutomations,
  executeCatchup,
} from "../../jobs/automation-catchup";

/**
 * POST /api/automation/catchup/start
 * Inicia manualmente o catch-up de automações
 */
export async function startCatchupController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Verificar se já está rodando
    if (AutomationExecutionService.isCatchupRunning()) {
      res.status(409).json({
        message: "Catch-up já está em execução",
        executionId: AutomationExecutionService.getCatchupExecutionId(),
      });
      return;
    }

    // Executar em background
    res.json({
      message: "Catch-up iniciado em background",
      status: "started",
    });

    // Executar catch-up (não aguardar)
    executeTodaysAutomations()
      .then((result) => {
        console.log("[Catchup Controller] Catch-up concluído:", result);
      })
      .catch((error) => {
        console.error("[Catchup Controller] Erro no catch-up:", error);
      });
  } catch (error) {
    console.error("[Start Catchup Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao iniciar catch-up",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/automation/catchup/stop
 * Para o catch-up em execução
 */
export async function stopCatchupController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Verificar se está rodando
    if (!AutomationExecutionService.isCatchupRunning()) {
      res.status(404).json({
        message: "Nenhum catch-up em execução",
      });
      return;
    }

    const executionId = AutomationExecutionService.getCatchupExecutionId();

    // Parar catch-up
    AutomationExecutionService.stopCatchup();

    res.json({
      message: "Catch-up cancelado com sucesso",
      executionId,
    });
  } catch (error) {
    console.error("[Stop Catchup Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao parar catch-up",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /api/automation/catchup/status
 * Verifica status do catch-up
 */
export async function getCatchupStatusController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const isRunning = AutomationExecutionService.isCatchupRunning();
    const executionId = AutomationExecutionService.getCatchupExecutionId();

    res.json({
      isRunning,
      executionId,
    });
  } catch (error) {
    console.error("[Get Catchup Status Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao verificar status do catch-up",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /api/automation/catchup/full
 * Executa catch-up completo (últimos 7 dias)
 */
export async function executeFullCatchupController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Verificar se já está rodando
    if (AutomationExecutionService.isCatchupRunning()) {
      res.status(409).json({
        message: "Catch-up já está em execução",
        executionId: AutomationExecutionService.getCatchupExecutionId(),
      });
      return;
    }

    // Executar em background
    res.json({
      message: "Catch-up completo iniciado em background",
      status: "started",
    });

    // Executar catch-up completo (não aguardar)
    executeCatchup()
      .then((result) => {
        console.log(
          "[Catchup Controller] Catch-up completo concluído:",
          result
        );
      })
      .catch((error) => {
        console.error("[Catchup Controller] Erro no catch-up completo:", error);
      });
  } catch (error) {
    console.error("[Execute Full Catchup Controller] Erro:", error);
    res.status(500).json({
      message: "Erro ao iniciar catch-up completo",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
