import { db, pool } from "../db";
import { baileysGatewayWebhookInbox } from "@shared/schema";
import {
  handleConnectionUpdate,
  handleMessagesUpdate,
  handleMessagesUpsert,
  handleMessagesReaction,
  handleQrcodeUpdated,
  handleMessagesDelete,
  handleMessageReceiptUpdates,
  handlePresenceUpdate,
  handleMessagingHistory,
} from "./whatsapp-baileys-events.service";

export interface GatewayWebhookEnvelope {
  event: "messages.upsert" | "messages.update" | "messages.reaction" | "messages.delete" | "message-receipt.update" | "presence.update" | "messaging-history.set" | "connection.update" | "qrcode.updated";
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
    case "messages.delete":
      await handleMessagesDelete(envelope.data);
      return;
    case "message-receipt.update":
      await handleMessageReceiptUpdates(envelope.data);
      return;
    case "presence.update":
      await handlePresenceUpdate(envelope.instance, envelope.data);
      return;
    case "messaging-history.set":
      await handleMessagingHistory(envelope.instance, envelope.data);
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

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerRunning = false;

export function startGatewayWebhookInboxWorker(): void {
  if (workerTimer) return;
  // Um processo pode cair depois do claim. Na inicialização, devolve esses
  // registros à fila; a deduplicação dos handlers torna o replay seguro.
  pool.query(
    `UPDATE baileys_gateway_webhook_inbox
     SET status='failed', next_attempt_at=now(),
         last_error=COALESCE(last_error, 'Processamento interrompido por restart')
     WHERE status='processing'`,
  ).catch((error) =>
    console.error("[Baileys Gateway Inbox] Falha ao recuperar eventos:", error),
  );
  workerTimer = setInterval(() => {
    if (workerRunning) return;
    workerRunning = true;
    processGatewayWebhookInboxBatch()
      .catch((error) => console.error("[Baileys Gateway Inbox] Worker falhou:", error))
      .finally(() => {
        workerRunning = false;
      });
  }, 2_000);
  workerTimer.unref();
}
