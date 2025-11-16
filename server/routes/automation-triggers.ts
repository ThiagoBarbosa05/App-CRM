import { Router, Request, Response } from "express";
import {
  executeCatchup,
  executeTodaysAutomations,
} from "../jobs/automation-catchup";
import {
  getMissedExecutions,
  getLastExecution,
  cleanOldExecutions,
} from "../jobs/automation-execution-tracker";
import { sendBirthdayMessagesForAutomation } from "../jobs/send-birthday-mensage";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";

const router = Router();

/**
 * Endpoint principal para trigger externo (cron-job.org, Uptime Robot, etc)
 * POST /api/automations/trigger
 *
 * Use este endpoint em serviços de cron externos para garantir execução diária
 */
router.post("/trigger", async (req: Request, res: Response) => {
  try {
    console.log("[Automation API] Trigger externo recebido");

    // Executar automações do dia
    const result = await executeTodaysAutomations();

    res.json({
      success: true,
      message: "Automações executadas com sucesso",
      data: {
        totalAutomations: result.totalAutomations,
        executed: result.executedAutomations,
        failed: result.failedAutomations,
        messagesSent: result.totalMessagesSent,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[Automation API] Erro no trigger:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao executar automações",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Endpoint para catch-up completo (recuperar execuções perdidas)
 * POST /api/automations/catchup
 *
 * Use este endpoint para recuperar automações que falharam nos últimos dias
 */
router.post("/catchup", async (req: Request, res: Response) => {
  try {
    console.log("[Automation API] Catch-up manual iniciado");

    const result = await executeCatchup();

    res.json({
      success: true,
      message: "Catch-up executado com sucesso",
      data: {
        totalAutomations: result.totalAutomations,
        executed: result.executedAutomations,
        failed: result.failedAutomations,
        messagesSent: result.totalMessagesSent,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[Automation API] Erro no catch-up:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao executar catch-up",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Health check para monitoramento
 * GET /api/automations/health
 *
 * Use em serviços como Uptime Robot para manter o app acordado
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter((a) => a.enabled);

    // Verificar automações perdidas
    const missedExecutions = await getMissedExecutions();

    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      data: {
        totalAutomations: automations.length,
        activeAutomations: activeAutomations.length,
        missedExecutions: missedExecutions.length,
        automations: activeAutomations.map((a) => ({
          id: a.id,
          scheduledTime: a.sendTime,
          daysBefore: a.daysBefore,
          type: a.type,
        })),
      },
    });
  } catch (error) {
    console.error("[Automation API] Erro no health check:", error);
    res.status(500).json({
      success: false,
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Status de execuções de uma automação específica
 * GET /api/automations/:automationId/status
 */
router.get("/:automationId/status", async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;

    const lastExecution = await getLastExecution(automationId);

    if (!lastExecution) {
      return res.json({
        success: true,
        message: "Automação nunca foi executada",
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        lastExecution: {
          date: lastExecution.executionDate,
          time: lastExecution.scheduledTime,
          status: lastExecution.status,
          messagesProcessed: lastExecution.messagesProcessed,
          messagesSent: lastExecution.messagesSent,
          messagesFailed: lastExecution.messagesFailed,
          triggeredBy: lastExecution.triggeredBy,
          executedAt: lastExecution.actualExecutionTime,
        },
      },
    });
  } catch (error) {
    console.error("[Automation API] Erro ao buscar status:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar status da automação",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Executar uma automação específica manualmente
 * POST /api/automations/:automationId/execute
 */
router.post("/:automationId/execute", async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;

    console.log(
      `[Automation API] Execução manual da automação ${automationId}`
    );

    await sendBirthdayMessagesForAutomation(automationId);

    res.json({
      success: true,
      message: `Automação ${automationId} executada com sucesso`,
    });
  } catch (error) {
    console.error("[Automation API] Erro na execução manual:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao executar automação",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Limpar logs antigos (> 30 dias)
 * POST /api/automations/cleanup
 */
router.post("/cleanup", async (req: Request, res: Response) => {
  try {
    console.log("[Automation API] Limpeza de logs antigos iniciada");

    await cleanOldExecutions();

    res.json({
      success: true,
      message: "Logs antigos removidos com sucesso",
    });
  } catch (error) {
    console.error("[Automation API] Erro na limpeza:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao limpar logs antigos",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
