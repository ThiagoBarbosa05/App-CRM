import cron from "node-cron";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { whatsappChannels } from "@shared/schema";
import { hasLocalLock } from "../services/baileys/session-manager";
import { tryAcquireInstanceLock, releaseInstanceLock } from "../services/baileys/instance-lock";
import { updateConnectionStatus } from "../services/whatsapp-channels.service";
import { logChannelConnectionEvent } from "../services/baileys/connection-events.service";

// Corrige `whatsapp_channels.connection_status` quando fica travado em
// "connected"/"connecting" sem nenhuma réplica com o socket Baileys vivo —
// acontece quando o processo cai sem disparar connection.update("close") a
// tempo (crash, OOM, deploy sem graceful shutdown). O advisory lock do
// Postgres (server/services/baileys/instance-lock.ts) é liberado
// automaticamente pelo próprio Postgres quando a conexão que o detém cai,
// então sondar o lock reflete com confiança se existe um socket vivo em
// qualquer réplica, sem depender de heartbeat algum.
export function startReconcileBaileysStatusJob() {
  cron.schedule("*/1 * * * *", async () => {
    try {
      await reconcileBaileysStatus();
    } catch (err) {
      console.error("[ReconcileBaileysStatus] Erro:", err);
    }
  });
}

export async function reconcileBaileysStatus(): Promise<void> {
  const rows = await db
    .select({ id: whatsappChannels.id, evolutionInstanceName: whatsappChannels.evolutionInstanceName })
    .from(whatsappChannels)
    .where(
      and(
        eq(whatsappChannels.provider, "evolution"),
        isNotNull(whatsappChannels.evolutionInstanceName),
        isNull(whatsappChannels.deletedAt),
        inArray(whatsappChannels.connectionStatus, ["connected", "connecting"]),
      ),
    );

  for (const row of rows) {
    const instanceName = row.evolutionInstanceName;
    if (!instanceName) continue;
    if (hasLocalLock(instanceName)) continue; // dona local — não briga com o fluxo reativo

    const client = await tryAcquireInstanceLock(instanceName).catch((err) => {
      console.error(`[ReconcileBaileysStatus] Falha ao sondar lock de "${instanceName}":`, err);
      return undefined;
    });
    if (client === undefined) continue; // erro de conexão — tenta de novo no próximo ciclo
    if (client === null) continue; // lock genuinamente detido por outra réplica — está conectado de verdade

    // Ninguém detinha o lock: nenhuma réplica tem o socket vivo desta instância.
    await releaseInstanceLock(instanceName, client);
    await updateConnectionStatus(row.id, "disconnected");
    await logChannelConnectionEvent(
      row.id,
      "disconnected",
      undefined,
      "Sessão perdida — processo encerrado sem notificar",
    ).catch((err) => console.error("[ReconcileBaileysStatus] Falha ao registrar evento:", err));
  }
}
