import cron from "node-cron";
import { runSyncWorker } from "./umbler-sync.worker";

/**
 * Scheduler para sincronização automática Umbler → CRM
 *
 * Estratégia de execução:
 * - Executa a cada 5 minutos durante horário comercial (8h-22h)
 * - Batch de 100 clientes por execução
 * - Rate limit respeitado pelo service (100 req/5s)
 *
 * Para ~5000 clientes:
 * - 50 execuções necessárias (ciclo completo)
 * - ~4 horas para ciclo completo (50 * 5min)
 * - ~6 ciclos completos por dia
 *
 * Configuração do cron:
 * - A cada 5 minutos, das 8h às 22h, todos os dias
 * - Para executar 24/7: use asteriscos em todos os campos
 * - Para executar apenas em dias úteis: adicione 1-5 no último campo
 */

// Estado do scheduler
let syncJob: ReturnType<typeof cron.schedule> | null = null;
let lastExecutionTime: Date | null = null;
let lastExecutionResult: any = null;

/**
 * Inicia o agendamento automático de sincronização
 * @param cronExpression - Expressão cron customizada (opcional)
 */
export function startUmblerSyncScheduler(
  cronExpression: string = "*/5 8-22 * * *"
): void {
  if (syncJob) {
    console.log(
      "[UmblerSyncScheduler] ⚠️ Scheduler já está ativo, cancelando anterior..."
    );
    syncJob.stop();
  }

  console.log(
    `[UmblerSyncScheduler] 🚀 Iniciando scheduler com expressão: ${cronExpression}`
  );
  console.log(`[UmblerSyncScheduler] 📅 Próxima execução será em ~5 minutos`);

  syncJob = cron.schedule(
    cronExpression,
    async () => {
      const startTime = new Date();
      console.log(
        `\n[UmblerSyncScheduler] ⏰ Executando sincronização agendada - ${startTime.toISOString()}`
      );

      try {
        const result = await runSyncWorker(100);

        lastExecutionTime = startTime;
        lastExecutionResult = result;

        if (result.success) {
          console.log(
            `[UmblerSyncScheduler] ✅ Sincronização concluída com sucesso`
          );
          console.log(
            `[UmblerSyncScheduler] 📊 Estatísticas:`,
            JSON.stringify(result.stats, null, 2)
          );
        } else {
          console.error(
            `[UmblerSyncScheduler] ❌ Sincronização falhou: ${result.message}`
          );
        }

        if (result.errors && result.errors.length > 0) {
          console.error(
            `[UmblerSyncScheduler] ⚠️ ${result.errors.length} erros encontrados:`,
            result.errors.slice(0, 5)
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[UmblerSyncScheduler] 💥 Erro crítico na execução agendada:`,
          errorMessage
        );
        lastExecutionResult = {
          success: false,
          message: errorMessage,
          stats: null,
        };
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      console.log(
        `[UmblerSyncScheduler] ⏱️ Execução finalizada em ${duration}ms\n`
      );
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  console.log(
    "[UmblerSyncScheduler] ✅ Scheduler ativado e aguardando próxima execução"
  );
}

/**
 * Para o agendamento automático
 */
export function stopUmblerSyncScheduler(): void {
  if (syncJob) {
    syncJob.stop();
    syncJob = null;
    console.log("[UmblerSyncScheduler] 🛑 Scheduler parado");
  } else {
    console.log("[UmblerSyncScheduler] ⚠️ Scheduler não estava ativo");
  }
}

/**
 * Retorna status do scheduler
 */
export function getSchedulerStatus(): {
  isActive: boolean;
  lastExecution: Date | null;
  lastResult: any;
} {
  return {
    isActive: syncJob !== null,
    lastExecution: lastExecutionTime,
    lastResult: lastExecutionResult,
  };
}

/**
 * Reinicia o scheduler com nova configuração
 */
export function restartUmblerSyncScheduler(cronExpression?: string): void {
  console.log("[UmblerSyncScheduler] 🔄 Reiniciando scheduler...");
  stopUmblerSyncScheduler();
  startUmblerSyncScheduler(cronExpression);
}

// Auto-start do scheduler quando o módulo é importado
console.log("[UmblerSyncScheduler] 🔧 Inicializando módulo de agendamento...");
startUmblerSyncScheduler();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log(
    "[UmblerSyncScheduler] 📴 Recebido SIGTERM, parando scheduler..."
  );
  stopUmblerSyncScheduler();
});

process.on("SIGINT", () => {
  console.log("[UmblerSyncScheduler] 📴 Recebido SIGINT, parando scheduler...");
  stopUmblerSyncScheduler();
});
