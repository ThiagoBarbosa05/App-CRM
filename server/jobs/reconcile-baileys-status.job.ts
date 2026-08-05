import cron from "node-cron";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { whatsappChannels } from "@shared/schema";
import { baileysGateway } from "../integrations/baileys-gateway";
import { updateConnectionStatus } from "../services/whatsapp-channels.service";
import { logChannelConnectionEvent } from "../services/baileys/connection-events.service";

export function startReconcileBaileysStatusJob(): void {
  cron.schedule("*/1 * * * *", async () => {
    try {
      await reconcileBaileysStatus();
    } catch (error) {
      console.error("[ReconcileBaileysStatus] Erro:", error);
    }
  });
}

/** Sincroniza o cache do CRM com o observed_state autoritativo do gateway. */
export async function reconcileBaileysStatus(): Promise<void> {
  const rows = await db
    .select({
      id: whatsappChannels.id,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
      connectionStatus: whatsappChannels.connectionStatus,
    })
    .from(whatsappChannels)
    .where(
      and(
        eq(whatsappChannels.provider, "evolution"),
        eq(whatsappChannels.qrBackend, "gateway"),
        isNotNull(whatsappChannels.evolutionInstanceName),
        isNull(whatsappChannels.deletedAt),
        inArray(whatsappChannels.connectionStatus, ["connected", "connecting", "disconnected"]),
      ),
    );

  for (const row of rows) {
    if (!row.evolutionInstanceName) continue;
    try {
      const observedState = (await baileysGateway.getInstance(row.evolutionInstanceName)).observed_state;
      const normalizedState = observedState === "connected" || observedState === "connecting"
        ? observedState
        : "disconnected";
      if (normalizedState === row.connectionStatus) continue;

      await updateConnectionStatus(row.id, normalizedState);
      if (normalizedState === "disconnected") {
        await logChannelConnectionEvent(
          row.id,
          "disconnected",
          undefined,
          "Gateway confirmou que a sessão está desconectada",
        ).catch((error) => console.error("[ReconcileBaileysStatus] Falha ao registrar evento:", error));
      }
    } catch (error) {
      // Falha de rede/gateway não prova que o WhatsApp caiu.
      console.error(`[ReconcileBaileysStatus] Falha ao consultar gateway de "${row.evolutionInstanceName}":`, error);
    }
  }
}
