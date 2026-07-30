import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGatewayWebhookSignature } from "../../routes/evolution-webhook.routes";

describe("assinatura do Baileys Gateway", () => {
  const secret = "secret-with-at-least-thirty-two-characters";
  const eventId = "event-1";
  const now = 1_753_790_400_000;
  const timestamp = String(now);
  const rawBody = Buffer.from('{"event":"connection.update"}');
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.${rawBody.toString("utf8")}`)
    .digest("hex");

  it("aceita o corpo cru assinado", () => {
    expect(
      verifyGatewayWebhookSignature({
        rawBody,
        eventId,
        timestamp,
        signature,
        secret,
        now,
      }),
    ).toBe(true);
  });

  it("rejeita corpo alterado e timestamp expirado", () => {
    expect(
      verifyGatewayWebhookSignature({
        rawBody: Buffer.from("{}"),
        eventId,
        timestamp,
        signature,
        secret,
        now,
      }),
    ).toBe(false);
    expect(
      verifyGatewayWebhookSignature({
        rawBody,
        eventId,
        timestamp,
        signature,
        secret,
        now: now + 300_001,
      }),
    ).toBe(false);
  });
});
