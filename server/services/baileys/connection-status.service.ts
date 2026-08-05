import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db";
import { whatsappChannels } from "@shared/schema";
import { publishSseEvent } from "../../lib/sse-hub";
import {
  invalidateChannelDirectory,
  listQrReaderUserIdsForChannel,
} from "../whatsapp-channels.service";
import { logChannelConnectionEvent } from "./connection-events.service";

export type ChannelConnectionStatus = "connected" | "connecting" | "qr" | "disconnected";

/** De onde veio a observação — só para log/diagnóstico. */
export type StatusSource = "webhook" | "reconcile" | "send" | "route";

export interface ApplyStatusOptions {
  source: StatusSource;
  /**
   * Instante em que o evento ACONTECEU (não em que chegou). Vem do envelope do
   * gateway; observações locais passam `new Date()`. Ausente = aceita sempre,
   * preservando o comportamento anterior enquanto o gateway não envia o campo.
   */
  occurredAt?: Date;
  reasonCode?: string;
  reasonLabel?: string;
  /** `false` muda o status sem poluir o "Histórico de conexão" do vendedor. */
  logEvent?: boolean;
}

export interface ApplyStatusResult {
  applied: boolean;
  status: ChannelConnectionStatus;
  reason: TransitionDecision["reason"];
}

export interface TransitionDecision {
  /** Grava no banco (ainda que só para avançar o carimbo de tempo). */
  write: boolean;
  /** Registra histórico e publica SSE. */
  notify: boolean;
  reason: "changed" | "unchanged" | "stale_event";
}

/**
 * Decide o que fazer com uma observação de status. Pura de propósito: os
 * serviços importam `server/db` no topo, então testar a regra aqui dispensa
 * banco (mesmo padrão de `buildSellerQueues` em copiloto.service.ts).
 *
 * A guarda de ordem existe porque os webhooks do gateway são entregues com
 * concorrência 4 e backoff independente por evento: um "close" reentregue
 * depois de um "open" chegaria por último e inverteria o status do canal.
 */
export function decideStatusTransition(
  current: { status: string | null; statusAt: Date | null },
  incoming: { status: ChannelConnectionStatus; occurredAt?: Date },
): TransitionDecision {
  if (
    incoming.occurredAt &&
    current.statusAt &&
    incoming.occurredAt.getTime() < current.statusAt.getTime()
  ) {
    return { write: false, notify: false, reason: "stale_event" };
  }
  if (current.status === incoming.status) {
    // Nada a fazer. Avançar o carimbo aqui seria ativamente nocivo: o polling
    // do QR reobserva "connecting" a cada 2,5s e empurraria o relógio à frente
    // do `open` que já aconteceu, fazendo a guarda descartar justamente o
    // webhook de conexão bem-sucedida.
    return { write: false, notify: false, reason: "unchanged" };
  }
  return { write: true, notify: true, reason: "changed" };
}

/**
 * Quem deve receber os eventos SSE de QR/status de um canal: o dono e qualquer
 * usuário com permissão explícita de leitura de QR (admins/gerentes podem
 * conectar canais que não são seus — ver canUserReadChannelQr). Sem isso, o
 * evento "conectado" só chega ao dono, e quem está de fato com o diálogo de QR
 * aberto (um admin, por ex.) nunca recebe a atualização.
 */
export async function getSseTargetUserIds(channel: {
  id: number;
  userId: string | null;
}): Promise<string[]> {
  const readerIds = await listQrReaderUserIdsForChannel(channel.id).catch(() => []);
  const ids = new Set(readerIds);
  if (channel.userId) ids.add(channel.userId);
  return Array.from(ids);
}

/**
 * ÚNICO ponto de escrita de `whatsapp_channels.connection_status` para canais
 * QR. Antes, cada writer (webhook, job de reconcile, pré-envio, rotas) fazia
 * seu próprio UPDATE e só o webhook publicava SSE — o resultado era o CRM
 * corrigir o banco e continuar exibindo "Conectado" na tela até um reload.
 *
 * Faz, nesta ordem: guarda de ordem → UPDATE atômico (a guarda se repete no
 * WHERE, contra corrida entre réplicas) → histórico → SSE.
 */
export async function applyChannelConnectionStatus(
  channelId: number,
  status: ChannelConnectionStatus,
  options: ApplyStatusOptions,
): Promise<ApplyStatusResult> {
  const [channel] = await db
    .select({
      id: whatsappChannels.id,
      userId: whatsappChannels.userId,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
      connectionStatus: whatsappChannels.connectionStatus,
      connectionStatusAt: whatsappChannels.connectionStatusAt,
    })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, channelId))
    .limit(1);

  if (!channel) return { applied: false, status, reason: "stale_event" };

  const decision = decideStatusTransition(
    { status: channel.connectionStatus, statusAt: channel.connectionStatusAt },
    { status, occurredAt: options.occurredAt },
  );

  if (!decision.write) {
    return { applied: false, status: channel.connectionStatus as ChannelConnectionStatus, reason: decision.reason };
  }

  const occurredAt = options.occurredAt ?? new Date();

  // A guarda se repete no WHERE: entre o SELECT acima e este UPDATE, outra
  // réplica pode ter aplicado um evento mais novo. Sem isso, o worker do inbox
  // (que roda em paralelo) reintroduziria a inversão que a guarda evita.
  const updated = await db
    .update(whatsappChannels)
    .set({ connectionStatus: status, connectionStatusAt: occurredAt })
    .where(
      and(
        eq(whatsappChannels.id, channelId),
        or(
          isNull(whatsappChannels.connectionStatusAt),
          lte(whatsappChannels.connectionStatusAt, occurredAt),
        ),
      ),
    )
    .returning({ id: whatsappChannels.id });

  if (updated.length === 0) {
    return { applied: false, status: channel.connectionStatus as ChannelConnectionStatus, reason: "stale_event" };
  }

  // Ao conectar, o canal normalmente acabou de ganhar `displayPhone` (ver
  // handleConnectionUpdate). Invalida o cache do diretório para que o PRIMEIRO
  // inbound logo após a conexão já reconheça este número como canal nosso.
  if (status === "connected") invalidateChannelDirectory();

  if (!decision.notify) return { applied: true, status, reason: decision.reason };

  if (options.logEvent !== false) {
    await logChannelConnectionEvent(
      channelId,
      status,
      options.reasonCode,
      options.reasonLabel,
    ).catch((err) =>
      console.error("[ConnectionStatus] Falha ao registrar evento de conexão:", err),
    );
  }

  const targetUserIds = await getSseTargetUserIds(channel);
  for (const userId of targetUserIds) {
    publishSseEvent(
      "evolution_connection_update",
      {
        channelId,
        instanceName: channel.evolutionInstanceName,
        connectionStatus: status,
        reasonLabel: options.reasonLabel ?? null,
        occurredAt: occurredAt.toISOString(),
        source: options.source,
      },
      userId,
    );
  }

  return { applied: true, status, reason: decision.reason };
}
