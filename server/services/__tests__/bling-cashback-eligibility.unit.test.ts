import { describe, expect, it } from "vitest";
import { decideBlingCashbackAction } from "../bling-cashback-eligibility";

describe("decideBlingCashbackAction", () => {
  it("does not create cashback for an open order", () => {
    expect(decideBlingCashbackAction(null, "1", false)).toBe("none");
  });

  it("creates cashback when an order becomes completed", () => {
    expect(decideBlingCashbackAction("1", "9", false)).toBe("create");
  });

  it("reuses active cashback on repeated completed updates", () => {
    expect(decideBlingCashbackAction("9", "9", true)).toBe("reuse");
  });

  it("cancels cashback when a completed order is reopened", () => {
    expect(decideBlingCashbackAction("9", "1", true)).toBe("cancel");
  });

  it("retries creation when completed order has no active cashback", () => {
    expect(decideBlingCashbackAction("9", "9", false)).toBe("create");
  });
});
