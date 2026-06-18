import { db } from "server/db";
import { whatsappAccountEvents } from "@shared/schema";

export async function logAccountEvent(
  field: string,
  eventType: string,
  payload: unknown,
  severity?: string,
): Promise<void> {
  await db.insert(whatsappAccountEvents).values({
    field,
    eventType,
    severity,
    payload: payload as Record<string, unknown>,
  });
}
