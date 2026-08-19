import { describe, expect, it } from "vitest";
import { canConfirmMessageAsSent } from "../../lib/whatsapp-message-status";

describe("canConfirmMessageAsSent", () => {
  it.each(["delivered", "read"] as const)(
    "does not regress a %s message to sent after the provider acknowledgement",
    (currentStatus) => {
      expect(canConfirmMessageAsSent(currentStatus, null)).toBe(false);
    },
  );

  it("confirms the initial local failure placeholder when no failure reason was recorded", () => {
    expect(canConfirmMessageAsSent("failed", null)).toBe(true);
  });

  it("does not overwrite a failure that has a recorded reason", () => {
    expect(canConfirmMessageAsSent("failed", "Conta restrita")).toBe(false);
  });
});
