import cron from "node-cron";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { whatsappChannels } from "@shared/schema";
import { BaileysGatewayError, baileysGateway } from "../integrations/baileys-gateway";
import {
  applyChannelConnectionStatus,
  type ChannelConnectionStatus,
} from "../services/baileys/connection-status.service";

export function startReconcileBaileysStatusJob(): void {
  cron.schedule("*/1 * * * *", async () => {
    try {
      await reconcileBaileysStatus();
    } catch (error) {
      console.error("[ReconcileBaileysStatus] Erro:", error);
    }
  });
}

/**
 * Traduz o `observed_state` do gateway para o vocabulário do CRM.
 * `lock_wait` = a sessão está presa noutra réplica e o gateway vai retentar;
 * `failed` = o gateway desistiu (ex.: SESSION_INVALID após logout no celular).
 */
function normalizeObservedState(observedState: string): ChannelConnectionStatus {
  if (observedState === "connected") return "connected";
  if (observedState === "connecting" || observedState === "lock_wait") return "connecting";
  if (observedState === "qr") return "qr";
  return "disconnected";
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
      ),
    );

  for (const row of rows) {
    if (!row.evolutionInstanceName) continue;
    try {
      const instance = await baileysGateway.getInstance(row.evolutionInstanceName);
      // `observed_state_stale`: o processo dono da sessão parou de bater
      // heartbeat (deploy, OOM, kill). A linha do gateway pode continuar
      // dizendo "connected" para sempre — não é confiável.
      const normalizedState = instance.observed_state_stale
        ? "disconnected"
        : normalizeObservedState(instance.observed_state);
      if (normalizedState === row.connectionStatus) continue;

      await applyChannelConnectionStatus(row.id, normalizedState, {
        source: "reconcile",
        occurredAt: new Date(),
        reasonLabel:
          normalizedState === "disconnected"
            ? instance.observed_state_stale
              ? "Gateway parou de responder pela sessão"
              : "Gateway confirmou que a sessão está desconectada"
            : undefined,
      });
    } catch (error) {
      if (error instanceof BaileysGatewayError && error.code === "not_found") {
        await updateConnectionStatus(row.id, "disconnected");
        await logChannelConnectionEvent(
          row.id,
          "disconnected",
          "INSTANCE_NOT_FOUND",
          "Instância do canal não existe no Baileys Gateway; reconecte via QR Code",
        ).catch((eventError) => console.error("[ReconcileBaileysStatus] Falha ao registrar evento:", eventError));
        continue;
      }
      // Falha de rede/gateway não prova que o WhatsApp caiu.
      console.error(`[ReconcileBaileysStatus] Falha ao consultar gateway de "${row.evolutionInstanceName}":`, error);
    }
  }
}
