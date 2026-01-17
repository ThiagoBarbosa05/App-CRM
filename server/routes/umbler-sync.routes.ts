import { Router } from "express";
import { umblerSyncService } from "../services/umbler-sync.service";
import { runSyncWorker, runCleanupWorker } from "../jobs/umbler-sync.worker";
import {
  getSchedulerStatus,
  restartUmblerSyncScheduler,
  stopUmblerSyncScheduler,
  startUmblerSyncScheduler,
} from "../jobs/umbler-sync-scheduler";
import { z } from "zod";

const router = Router();

/**
 * GET /api/umbler-sync/stats
 * Retorna estatísticas de sincronização
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await umblerSyncService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[UmblerSync] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync statistics",
    });
  }
});

/**
 * POST /api/umbler-sync/trigger
 * Dispara sincronização manual
 *
 * Body:
 * - batchSize (opcional): número de clientes por batch (default: 100)
 * - clientIds (opcional): array de IDs específicos para sincronizar
 */
router.post("/trigger", async (req, res) => {
  try {
    const schema = z.object({
      batchSize: z.number().min(1).max(500).optional().default(100),
      clientIds: z.array(z.string()).optional(),
    });

    const data = schema.parse(req.body);

    // Verifica se já há sync em andamento
    if (umblerSyncService.isSyncInProgress()) {
      return res.status(409).json({
        success: false,
        error: "Sync already in progress",
      });
    }

    // Executa sincronização
    const result = await runSyncWorker(data.batchSize);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.stats,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
        data: result.stats,
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("[UmblerSync] Error triggering sync:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to trigger sync",
    });
  }
});

/**
 * POST /api/umbler-sync/sync-client/:clientId
 * Sincroniza um cliente específico
 */
router.post("/sync-client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    await umblerSyncService.syncSingleClient(clientId);

    res.json({
      success: true,
      message: `Client ${clientId} synced successfully`,
    });
  } catch (error) {
    console.error(`[UmblerSync] Error syncing client:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      success: false,
      error: `Failed to sync client: ${errorMessage}`,
    });
  }
});

/**
 * POST /api/umbler-sync/cleanup
 * Limpa snapshots órfãos (clientes deletados)
 */
router.post("/cleanup", async (req, res) => {
  try {
    const result = await runCleanupWorker();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          deletedCount: result.deletedCount,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    console.error("[UmblerSync] Error during cleanup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup orphaned snapshots",
    });
  }
});

/**
 * GET /api/umbler-sync/status
 * Retorna status do sincronizador
 */
router.get("/status", async (req, res) => {
  try {
    const isRunning = umblerSyncService.isSyncInProgress();
    const stats = await umblerSyncService.getStats();
    const schedulerStatus = getSchedulerStatus();

    res.json({
      success: true,
      data: {
        isRunning,
        stats,
        scheduler: schedulerStatus,
      },
    });
  } catch (error) {
    console.error("[UmblerSync] Error getting status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync status",
    });
  }
});

/**
 * POST /api/umbler-sync/scheduler/restart
 * Reinicia o scheduler com nova configuração (opcional)
 *
 * Body:
 * - cronExpression (opcional): expressão cron customizada
 */
router.post("/scheduler/restart", async (req, res) => {
  try {
    const schema = z.object({
      cronExpression: z.string().optional(),
    });

    const data = schema.parse(req.body);

    restartUmblerSyncScheduler(data.cronExpression);

    res.json({
      success: true,
      message: "Scheduler reiniciado com sucesso",
      data: getSchedulerStatus(),
    });
  } catch (error) {
    console.error("[UmblerSync] Error restarting scheduler:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restart scheduler",
    });
  }
});

/**
 * POST /api/umbler-sync/scheduler/stop
 * Para o scheduler
 */
router.post("/scheduler/stop", async (req, res) => {
  try {
    stopUmblerSyncScheduler();

    res.json({
      success: true,
      message: "Scheduler parado com sucesso",
      data: getSchedulerStatus(),
    });
  } catch (error) {
    console.error("[UmblerSync] Error stopping scheduler:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop scheduler",
    });
  }
});

/**
 * POST /api/umbler-sync/scheduler/start
 * Inicia o scheduler
 *
 * Body:
 * - cronExpression (opcional): expressão cron customizada
 */
router.post("/scheduler/start", async (req, res) => {
  try {
    const schema = z.object({
      cronExpression: z.string().optional(),
    });

    const data = schema.parse(req.body);

    startUmblerSyncScheduler(data.cronExpression);

    res.json({
      success: true,
      message: "Scheduler iniciado com sucesso",
      data: getSchedulerStatus(),
    });
  } catch (error) {
    console.error("[UmblerSync] Error starting scheduler:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start scheduler",
    });
  }
});

export default router;
