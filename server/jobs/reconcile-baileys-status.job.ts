import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { whatsappChannels } from "@shared/schema";
import { BaileysGatewayError, baileysGateway } from "../integrations/baileys-gateway";
import {
  applyChannelConnectionStatus,
  touchChannelConnectionCheckedAt,
  type ChannelConnectionStatus,
} from "../services/baileys/connection-status.service";

/**
 * Um tick da reconciliação. Agendado pelo worker de background — ver
 * server/jobs/registry.ts.
 */
export async function runReconcileBaileysStatusTick(): Promise<void> {
  try {
    await reconcileBaileysStatus();
  } catch (error) {
    console.error("[ReconcileBaileysStatus] Erro:", error);
  }
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

/**
 * Por quanto tempo o gateway pode ficar inalcançável antes de o canal ser
 * marcado offline.
 *
 * Antes isto era um contador de falhas consecutivas em memória do processo.
 * Não sobrevive ao worker de background, que é um container efêmero: cada
 * execução começaria com o mapa vazio, chegaria a 1 falha e nunca ao limite —
 * um gateway fora do ar deixaria "Conectado" na tela para sempre.
 *
 * `connection_checked_at` é o mesmo sinal, só que durável e compartilhado
 * entre réplicas: `touchChannelConnectionCheckedAt` o carimba a cada resposta
 * bem-sucedida do gateway, então "faz mais de 30 min que ninguém confirma este
 * canal" é exatamente a condição que queremos.
 */
const UNREACHABLE_GRACE_MS = 30 * 60 * 1000;

/**
 * Falhas que significam "não consegui falar com o gateway". `unauthorized`,
 * `not_configured` e `rate_limited` ficam de fora de propósito: são problemas
 * de configuração/cota do CRM, não evidência sobre a sessão do WhatsApp, e
 * degradar por causa deles encheria o histórico de conexão do vendedor.
 */
function isGatewayUnreachable(error: unknown): boolean {
  if (!(error instanceof BaileysGatewayError)) return true;
  return (
    error.code === "unavailable" ||
    error.code === "overloaded" ||
    error.code === "unexpected"
  );
}

/** Sincroniza o cache do CRM com o observed_state autoritativo do gateway. */
export async function reconcileBaileysStatus(): Promise<void> {
  const rows = await db
    .select({
      id: whatsappChannels.id,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
      connectionStatus: whatsappChannels.connectionStatus,
      connectionCheckedAt: whatsappChannels.connectionCheckedAt,
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
    // Guarda por linha: um canal problemático não pode abortar a reconciliação
    // dos demais. Era exatamente esse o efeito do ReferenceError que vivia no
    // catch abaixo — bastava UM canal em 404 para o job inteiro morrer e todos
    // os outros congelarem no último status conhecido.
    try {
      await reconcileChannel(row);
    } catch (error) {
      console.error(`[ReconcileBaileysStatus] Falha ao reconciliar canal ${row.id}:`, error);
    }
  }
}

interface ReconcileRow {
  id: number;
  evolutionInstanceName: string | null;
  connectionStatus: string | null;
  connectionCheckedAt: Date | null;
}

async function reconcileChannel(row: ReconcileRow): Promise<void> {
  if (!row.evolutionInstanceName) return;
  try {
    const instance = await baileysGateway.getInstance(row.evolutionInstanceName);

    // `observed_state_stale`: o processo dono da sessão parou de bater
    // heartbeat (deploy, OOM, kill). A linha do gateway pode continuar
    // dizendo "connected" para sempre — não é confiável.
    const normalizedState = instance.observed_state_stale
      ? "disconnected"
      : normalizeObservedState(instance.observed_state);

    // O gateway respondeu: o status passou a ser verificado AGORA, mesmo que
    // não tenha mudado. É o que diferencia "conectado e confirmado" de
    // "conectado segundo um cache antigo" (ver connection-status.service).
    await touchChannelConnectionCheckedAt(row.id);

    if (normalizedState === row.connectionStatus) return;

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
      // O gateway respondeu — só não conhece esta instância. Não conta como
      // indisponibilidade, e a sessão precisa ser pareada de novo.
      await applyChannelConnectionStatus(row.id, "disconnected", {
        source: "reconcile",
        occurredAt: new Date(),
        reasonCode: "INSTANCE_NOT_FOUND",
        reasonLabel: "Instância do canal não existe no Baileys Gateway; reconecte via QR Code",
      });
      return;
    }

    if (!isGatewayUnreachable(error)) {
      console.error(
        `[ReconcileBaileysStatus] Erro ao consultar gateway de "${row.evolutionInstanceName}":`,
        error,
      );
      return;
    }

    // Gateway inalcançável não prova que o WhatsApp caiu — mas manter
    // "Conectado" na tela indefinidamente mente para o vendedor, já que com o
    // gateway fora nenhuma mensagem sai. Tolera a janela de graça e degrada.
    //
    // `connectionCheckedAt` nulo significa que este canal nunca teve uma
    // confirmação do gateway: não há o que degradar por indisponibilidade, e
    // carimbar "offline" agora sobrescreveria um estado que ninguém verificou.
    const lastCheck = row.connectionCheckedAt?.getTime();
    const unreachableFor = lastCheck === undefined ? 0 : Date.now() - lastCheck;
    if (unreachableFor < UNREACHABLE_GRACE_MS) {
      console.error(
        `[ReconcileBaileysStatus] Gateway indisponível para "${row.evolutionInstanceName}" ` +
          `(sem confirmação há ${Math.round(unreachableFor / 60_000)} min):`,
        error,
      );
      return;
    }

    await applyChannelConnectionStatus(row.id, "disconnected", {
      source: "reconcile",
      occurredAt: new Date(),
      reasonCode: "GATEWAY_UNREACHABLE",
      reasonLabel: "Gateway indisponível",
    });
  }
}
