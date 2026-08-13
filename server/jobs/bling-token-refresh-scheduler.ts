import { blingConnectionsService } from "../services/bling-connections.service";

/**
 * Marca conexões Bling expiradas e renova as que estão perto de vencer.
 * Agendado pelo worker de background (ver server/jobs/registry.ts).
 */
export async function refreshBlingConnections(): Promise<void> {
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
