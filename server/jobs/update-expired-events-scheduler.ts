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

// Agendado à meia-noite (horário de São Paulo) pelo worker de background — ver
// server/jobs/registry.ts. O cron de 1 minuto que existia só em
// NODE_ENV=development foi removido: rodava a varredura 1440x por dia para
// nada.
export { updateExpiredEvents };
