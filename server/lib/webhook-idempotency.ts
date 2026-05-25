import crypto from "crypto";
import { db } from "server/db";
import { webhookEvents } from "@shared/schema";

/**
 * Registra o evento e retorna `true` se é a primeira vez (deve processar).
 * Retorna `false` quando o `(provider, eventId)` já foi processado (deduplica).
 */
export async function recordWebhookEvent(
  provider: string,
  eventId: string,
  payload?: unknown,
): Promise<boolean> {
  const payloadHash = payload
    ? crypto
        .createHash("sha256")
        .update(typeof payload === "string" ? payload : JSON.stringify(payload))
        .digest("hex")
    : null;

  const inserted = await db
    .insert(webhookEvents)
    .values({ provider, eventId, payloadHash })
    .onConflictDoNothing({
      target: [webhookEvents.provider, webhookEvents.eventId],
    })
    .returning({ id: webhookEvents.id });

  return inserted.length > 0;
}
