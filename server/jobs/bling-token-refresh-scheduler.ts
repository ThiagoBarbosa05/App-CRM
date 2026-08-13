import cron from "node-cron";
import { blingConnectionsService } from "../services/bling-connections.service";

async function refreshBlingConnections(): Promise<void> {
  try {
    const expiredCount = await blingConnectionsService.markExpiredConnections();
    const refreshedCount = await blingConnectionsService.refreshConnectionsExpiringSoon();

    if (expiredCount > 0 || refreshedCount > 0) {
      console.log(
        `[Bling Scheduler] ${expiredCount} conexoes expiradas e ${refreshedCount} conexoes renovadas.`,
      );
    }
  } catch (error) {
    console.error("[Bling Scheduler] Erro ao renovar conexoes do Bling:", error);
  }
}

cron.schedule(
  "*/15 * * * *",
  async () => {
    await refreshBlingConnections();
  },
  {
    timezone: "America/Sao_Paulo",
  },
);

refreshBlingConnections().catch((error) => {
  console.error("[Bling Scheduler] Erro ao iniciar rotina de refresh do Bling:", error);
});
