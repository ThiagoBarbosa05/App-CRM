import { sql } from "drizzle-orm";
import { toE164Brazil } from "../lib/twilio-config";

export type AutomationDeliveryChannel = "sms" | "email";

export interface DeliveryClaimInput {
  ruleId: string;
  clientId: string | null;
  channel: AutomationDeliveryChannel;
  templateId: string;
  eventKey: string;
  recipient: string;
}

export interface SqlExecutor {
  execute(query: ReturnType<typeof sql>): Promise<{ rows: Array<{ id: string }> }>;
}

export function normalizeAutomationRecipient(
  channel: AutomationDeliveryChannel,
  recipient: string,
): string {
  return channel === "sms" ? toE164Brazil(recipient) : recipient.trim().toLowerCase();
}

/**
 * Reserva uma entrega antes de chamar o provedor. O índice único no banco é a
 * fonte de verdade contra concorrência entre processos/instâncias.
 */
export async function claimAutomationDelivery(
  executor: SqlExecutor,
  input: DeliveryClaimInput,
): Promise<{ id: string; recipient: string } | null> {
  const recipient = normalizeAutomationRecipient(input.channel, input.recipient);
  const result = await executor.execute(sql`
    INSERT INTO "automation_deliveries" (
      "rule_id", "client_id", "channel", "template_id", "event_key", "recipient", "status"
    ) VALUES (
      ${input.ruleId}, ${input.clientId}, ${input.channel}, ${input.templateId},
      ${input.eventKey}, ${recipient}, 'processing'
    )
    ON CONFLICT ("event_key", "channel") DO NOTHING
    RETURNING "id"
  `);
  const [row] = result.rows;
  return row ? { id: row.id, recipient } : null;
}
