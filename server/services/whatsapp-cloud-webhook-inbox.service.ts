import { createHash } from "node:crypto";
import { db, pool } from "../db";
import { whatsappCloudWebhookInbox } from "@shared/schema";

export type WhatsappCloudWebhookPayload = Record<string, unknown>;

type Dispatcher = (payload: WhatsappCloudWebhookPayload) => Promise<void>;

let dispatcher: Dispatcher | null = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerRunning = false;

export function registerWhatsappCloudWebhookDispatcher(nextDispatcher: Dispatcher): void {
  dispatcher = nextDispatcher;
}

export async function enqueueWhatsappCloudWebhook(
  payload: WhatsappCloudWebhookPayload,
): Promise<"created" | "duplicate"> {
  const eventId = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const inserted = await db
    .insert(whatsappCloudWebhookInbox)
    .values({ eventId, payload })
    .onConflictDoNothing()
    .returning({ eventId: whatsappCloudWebhookInbox.eventId });
  return inserted.length > 0 ? "created" : "duplicate";
}

interface ClaimedEvent {
  event_id: string;
  payload: WhatsappCloudWebhookPayload;
  attempts: number;
}

async function claimOne(): Promise<ClaimedEvent | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ClaimedEvent>(`
      SELECT event_id, payload, attempts
      FROM whatsapp_cloud_webhook_inbox
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
      `UPDATE whatsapp_cloud_webhook_inbox
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

export async function processWhatsappCloudWebhookInboxBatch(limit = 10): Promise<number> {
  if (!dispatcher) throw new Error("Dispatcher do webhook Cloud API não registrado");
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const event = await claimOne();
    if (!event) break;
    try {
      await dispatcher(event.payload);
      await pool.query(
        `UPDATE whatsapp_cloud_webhook_inbox
         SET status='processed', processed_at=now(), last_error=NULL
         WHERE event_id=$1`,
        [event.event_id],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const delaySeconds = Math.min(300, 2 ** Math.min(event.attempts + 1, 8));
      await pool.query(
        `UPDATE whatsapp_cloud_webhook_inbox
         SET status='failed', last_error=$2,
             next_attempt_at=now()+($3::text || ' seconds')::interval
         WHERE event_id=$1`,
        [event.event_id, message.slice(0, 4000), delaySeconds],
      );
      console.error(`[WhatsApp Cloud Inbox] Evento ${event.event_id} falhou:`, error);
    }
    processed += 1;
  }
  return processed;
}

export function startWhatsappCloudWebhookInboxWorker(): void {
  if (workerTimer) return;
  pool.query(
    `UPDATE whatsapp_cloud_webhook_inbox
     SET status='failed', next_attempt_at=now(),
         last_error=COALESCE(last_error, 'Processamento interrompido por restart')
     WHERE status='processing'`,
  ).catch((error) =>
    console.error("[WhatsApp Cloud Inbox] Falha ao recuperar eventos:", error),
  );
  workerTimer = setInterval(() => {
    if (workerRunning) return;
    workerRunning = true;
    processWhatsappCloudWebhookInboxBatch()
      .catch((error) => console.error("[WhatsApp Cloud Inbox] Worker falhou:", error))
      .finally(() => {
        workerRunning = false;
      });
  }, 2_000);
  workerTimer.unref();
}
