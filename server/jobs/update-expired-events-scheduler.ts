import cron from "node-cron";
import { storage } from "../storage";

/**
 * Atualiza eventos cuja data já passou para status "finalizado"
 */
async function updateExpiredEvents(): Promise<void> {
  try {
    console.log("[Scheduler] Verificando eventos expirados...");
    const updatedCount = await storage.updateExpiredEvents();
    
    if (updatedCount > 0) {
      console.log(
        `[Scheduler] ${updatedCount} evento(s) atualizado(s) para status "finalizado".`
      );
    } else {
      console.log("[Scheduler] Nenhum evento expirado encontrado.");
    }
  } catch (error) {
    console.error("[Scheduler] Erro ao atualizar eventos expirados:", error);
  }
}

/**
 * Job principal que roda todos os dias à meia-noite (00:00)
 * para atualizar eventos que já passaram
 */
cron.schedule(
  "0 0 * * *",
  async () => {
    console.log("[Scheduler] Executando verificação diária de eventos expirados...");
    await updateExpiredEvents();
  },
  {
    timezone: "America/Sao_Paulo",
  }
);

/**
 * Job de desenvolvimento que roda a cada minuto para testes
 * Apenas em ambiente de desenvolvimento
 */
if (process.env.NODE_ENV === "development") {
  cron.schedule("* * * * *", async () => {
    console.log(
      "[Scheduler - DEV] Verificando eventos expirados (desenvolvimento)..."
    );
    await updateExpiredEvents();
  });
}

// Executar uma verificação inicial ao iniciar o servidor
updateExpiredEvents()
  .then(() => {
    console.log("[Scheduler] Sistema de atualização automática de eventos iniciado.");
  })
  .catch((error) => {
    console.error("[Scheduler] Erro ao iniciar sistema de atualização de eventos:", error);
  });

// Exportar a função para uso externo se necessário
export { updateExpiredEvents };
