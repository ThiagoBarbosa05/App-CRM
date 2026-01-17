import { fileURLToPath } from "url";
import { umblerSyncService } from "../services/umbler-sync.service";

/**
 * Worker de sincronização Umbler → CRM
 *
 * Executa sincronização em batches de 100 clientes por vez
 *
 * Estratégia:
 * - Processa 100 clientes por execução
 * - Rate limit: 100 req/5s (respeitado pelo service)
 * - Ciclo completo: ~50 execuções (para 5000 clientes)
 * - Tempo estimado: ~25 minutos para ciclo completo
 *
 * Uso:
 * 1. Cron job: node -r esbuild-register server/jobs/umbler-sync.worker.ts
 * 2. Manual: POST /api/umbler-sync/trigger
 */

export interface WorkerResult {
  success: boolean;
  message: string;
  stats: {
    clientsProcessed: number;
    clientsSynced: number;
    clientsNotFound: number;
    clientsError: number;
    duration: number;
  };
  errors?: Array<{ clientId: string; error: string }>;
}

/**
 * Executa um ciclo de sincronização
 */
export async function runSyncWorker(batchSize = 100): Promise<WorkerResult> {
  const startTime = Date.now();

  console.log("[UmblerSyncWorker] Starting sync worker...");
  console.log(`[UmblerSyncWorker] Batch size: ${batchSize}`);

  try {
    // Verifica se já há sync em andamento
    if (umblerSyncService.isSyncInProgress()) {
      return {
        success: false,
        message: "Sync already in progress",
        stats: {
          clientsProcessed: 0,
          clientsSynced: 0,
          clientsNotFound: 0,
          clientsError: 0,
          duration: Date.now() - startTime,
        },
      };
    }

    // Executa sincronização
    const result = await umblerSyncService.syncBatch({ batchSize });

    // Log de resultado
    console.log("[UmblerSyncWorker] Sync completed", {
      success: result.success,
      processed: result.clientsProcessed,
      synced: result.clientsSynced,
      notFound: result.clientsNotFound,
      errors: result.clientsError,
      duration: `${result.duration}ms`,
    });

    return {
      success: result.success,
      message: `Sync completed successfully. Processed ${result.clientsProcessed} clients.`,
      stats: {
        clientsProcessed: result.clientsProcessed,
        clientsSynced: result.clientsSynced,
        clientsNotFound: result.clientsNotFound,
        clientsError: result.clientsError,
        duration: result.duration,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[UmblerSyncWorker] Sync failed:", errorMessage);

    return {
      success: false,
      message: `Sync failed: ${errorMessage}`,
      stats: {
        clientsProcessed: 0,
        clientsSynced: 0,
        clientsNotFound: 0,
        clientsError: 0,
        duration: Date.now() - startTime,
      },
    };
  }
}

/**
 * Executa limpeza de snapshots órfãos
 */
export async function runCleanupWorker(): Promise<{
  success: boolean;
  message: string;
  deletedCount: number;
}> {
  console.log("[UmblerSyncWorker] Starting cleanup worker...");

  try {
    const deletedCount = await umblerSyncService.cleanupOrphans();

    console.log(
      `[UmblerSyncWorker] Cleanup completed. Deleted ${deletedCount} orphaned snapshots.`
    );

    return {
      success: true,
      message: `Cleanup completed. Deleted ${deletedCount} orphaned snapshots.`,
      deletedCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[UmblerSyncWorker] Cleanup failed:", errorMessage);

    return {
      success: false,
      message: `Cleanup failed: ${errorMessage}`,
      deletedCount: 0,
    };
  }
}

/**
 * Execução standalone (para cron job)
 * Em ES modules, verificamos se o arquivo está sendo executado diretamente
 */
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  runSyncWorker()
    .then((result) => {
      console.log("[UmblerSyncWorker] Worker finished:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("[UmblerSyncWorker] Worker crashed:", error);
      process.exit(1);
    });
}
