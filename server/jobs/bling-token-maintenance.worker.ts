import { pathToFileURL } from "url";
import { blingConnectionsService } from "../services/bling-connections.service";

export interface BlingTokenMaintenanceResult {
  refreshedCount: number;
  expiredCount: number;
}

/**
 * Manutencao de baixa frequencia para preservar refresh tokens de contas sem uso.
 * A validade de 30 dias e estimada porque o OAuth do Bling nao informa a
 * expiracao do refresh token na resposta atual.
 */
export async function runBlingTokenMaintenance(): Promise<BlingTokenMaintenanceResult> {
  const refreshedCount =
    await blingConnectionsService.refreshConnectionsExpiringSoon();
  const expiredCount = await blingConnectionsService.markExpiredConnections();

  console.info(
    `[Bling Token Maintenance] ${refreshedCount} candidatas processadas; ${expiredCount} expiradas.`,
  );
  return { refreshedCount, expiredCount };
}

export async function handler(): Promise<BlingTokenMaintenanceResult> {
  return runBlingTokenMaintenance();
}

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (entrypoint === import.meta.url) {
  runBlingTokenMaintenance().catch((error: unknown) => {
    console.error("[Bling Token Maintenance] Falha:", error);
    process.exitCode = 1;
  });
}
