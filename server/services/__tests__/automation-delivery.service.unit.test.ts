import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  claimAutomationDelivery,
  normalizeAutomationRecipient,
  type DeliveryClaimInput,
} from "../automation-delivery.service";

const input: DeliveryClaimInput = {
  ruleId: "rule-1",
  clientId: "client-1",
  channel: "sms",
  templateId: "template-1",
  eventKey: "cashback_earned:rule-1:transaction-1",
  recipient: "(11) 99999-0000",
};

describe("automation delivery reservation", () => {
  it("normalizes Brazilian SMS recipients to E.164", () => {
    expect(normalizeAutomationRecipient("sms", "(11) 99999-0000")).toBe(
      "+5511999990000",
    );
  });

  it("creates a delivery only when the event and channel were not reserved", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: "delivery-1" }] });

    await expect(claimAutomationDelivery({ execute }, input)).resolves.toEqual({
      id: "delivery-1",
      recipient: "+5511999990000",
    });

    const emittedSql = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(emittedSql).toContain("INSERT INTO \"automation_deliveries\"");
    expect(emittedSql).toContain("ON CONFLICT (\"event_key\", \"channel\") DO NOTHING");
  });

  it("does not claim a delivery already reserved by another worker", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });

    await expect(claimAutomationDelivery({ execute }, input)).resolves.toBeNull();
  });
});
