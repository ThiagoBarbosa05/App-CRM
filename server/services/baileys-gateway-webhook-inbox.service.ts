import { db, pool } from "../db";
import { baileysGatewayWebhookInbox } from "@shared/schema";
import {
  handleConnectionUpdate,
  handleMessagesUpdate,
  handleMessagesUpsert,
  handleMessagesReaction,
  handleQrcodeUpdated,
} from "./whatsapp-baileys-events.service";

export interface GatewayWebhookEnvelope {
  event: "messages.upsert" | "messages.update" | "messages.reaction" | "connection.update" | "qrcode.updated";
  instance: string;
  data: unknown;
  /**
   * Instante em que o evento aconteceu no gateway (ISO). Diferente de
   * `x-gateway-timestamp`, que é o instante da ENTREGA e muda a cada retry.
   * Opcional: gateways anteriores à v2.1 não enviam o campo.
   */
  occurredAt?: string;
}

/** Converte o `occurredAt` do envelope em Date, ignorando valores inválidos. */
function parseOccurredAt(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function enqueueGatewayWebhook(
  eventId: string,
  envelope: GatewayWebhookEnvelope,
): Promise<"created" | "duplicate"> {
  const inserted = await db
    .insert(baileysGatewayWebhookInbox)
    .values({
      eventId,
      eventName: envelope.event,
      instanceName: envelope.instance,
      payload: envelope,
    })
    .onConflictDoNothing()
    .returning({ eventId: baileysGatewayWebhookInbox.eventId });
  return inserted.length > 0 ? "created" : "duplicate";
}

async function dispatch(envelope: GatewayWebhookEnvelope): Promise<void> {
  switch (envelope.event) {
    case "messages.upsert":
      await handleMessagesUpsert(envelope.instance, envelope.data);
      return;
    case "messages.update":
      await handleMessagesUpdate(envelope.data);
      return;
    case "messages.reaction":
      await handleMessagesReaction(envelope.instance, envelope.data);
      return;
    case "connection.update":
      await handleConnectionUpdate(
        envelope.instance,
        envelope.data,
        parseOccurredAt(envelope.occurredAt),
      );
      return;
    case "qrcode.updated":
      await handleQrcodeUpdated(
        envelope.instance,
        envelope.data,
        parseOccurredAt(envelope.occurredAt),
      );
  }
}

interface ClaimedEvent {
  event_id: string;
  payload: GatewayWebhookEnvelope;
  attempts: number;
}

async function claimOne(): Promise<ClaimedEvent | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ClaimedEvent>(`
      SELECT event_id, payload, attempts
      FROM baileys_gateway_webhook_inbox
      WHERE status IN ('pending', 'failed') AND next_attempt_at <= now()
      ORDER BY received_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const event = result.rows[0];
    if (!event) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE baileys_gateway_webhook_inbox
       SET status='processing', attempts=attempts+1 WHERE event_id=$1`,
      [event.event_id],
    );
    await client.query("COMMIT");
    return event;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function processGatewayWebhookInboxBatch(limit = 10): Promise<number> {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const event = await claimOne();
    if (!event) break;
    try {
      await dispatch(event.payload);
      await pool.query(
        `UPDATE baileys_gateway_webhook_inbox
         SET status='processed', processed_at=now(), last_error=NULL
         WHERE event_id=$1`,
        [event.event_id],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts + 1, 8));
      await pool.query(
        `UPDATE baileys_gateway_webhook_inbox
         SET status='failed', last_error=$2,
             next_attempt_at=now()+($3::text || ' seconds')::interval
         WHERE event_id=$1`,
        [event.event_id, message.slice(0, 4000), delaySeconds],
      );
      console.error(`[Baileys Gateway Inbox] Evento ${event.event_id} falhou:`, error);
    }
    processed += 1;
  }
  return processed;
}

/**
 * Um processo pode cair depois do claim, deixando o registro preso em
 * `processing`. Devolve esses eventos à fila; a deduplicação dos handlers torna
 * o replay seguro. Roda no worker de background, não no boot do processo web —
 * com scale-to-zero, o boot acontece a cada subida de instância.
 */
export async function recoverStuckGatewayWebhooks(): Promise<void> {
  await pool.query(
    `UPDATE baileys_gateway_webhook_inbox
     SET status='failed', next_attempt_at=now(),
         last_error=COALESCE(last_error, 'Processamento interrompido por restart')
     WHERE status='processing'`,
  );
}

let draining = false;
let drainRequested = false;

/**
 * Drena a fila imediatamente, sem bloquear quem chamou.
 *
 * O gateway entrega os eventos por push, então varrer a fila em intervalo fixo
 * era puro desperdício: mantinha uma transação a cada 2s mesmo com a fila
 * vazia, e — no Autoscale — segurava CPU alocada 24h por dia. Agora o próprio
 * POST do webhook dispara o processamento depois de responder 202.
 *
 * O `drainRequested` fecha a janela de corrida em que um evento novo chega
 * enquanto o laço anterior já checou a fila pela última vez: em vez de esperar
 * o job de retentativa, o laço reinicia. Retentativas com `next_attempt_at` no
 * futuro não são reclamadas, então o laço sempre termina.
 */
export function drainGatewayWebhookInbox(): void {
  drainRequested = true;
  if (draining) return;
  draining = true;
  void (async () => {
    try {
      while (drainRequested) {
        drainRequested = false;
        while ((await processGatewayWebhookInboxBatch()) > 0) {
          // continua enquanto houver evento elegível
        }
      }
    } catch (error) {
      console.error("[Baileys Gateway Inbox] Drain falhou:", error);
    } finally {
      draining = false;
    }
  })();
}
