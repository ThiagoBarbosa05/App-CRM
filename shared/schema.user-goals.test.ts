import { describe, expect, it } from "vitest";

import { insertUserGoalSchema } from "./schema";

describe("insertUserGoalSchema", () => {
  it("drops deprecated wine tier goal fields from the payload", () => {
    const parsedGoal = insertUserGoalSchema.parse({
      userId: "user-1",
      salesGoal: "1000.00",
      averageTicket: "100.00",
      itemsPerSale: 2,
      economicoGoalQty: 3,
      intermediarioGoalQty: 4,
      premiumGoalQty: 5,
      month: 4,
      year: 2026,
    });

    expect(parsedGoal).not.toHaveProperty("economicoGoalQty");
    expect(parsedGoal).not.toHaveProperty("intermediarioGoalQty");
    expect(parsedGoal).not.toHaveProperty("premiumGoalQty");
  });
});
