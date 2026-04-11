import { describe, expect, it } from "vitest";

import { getBottleGoalProgress } from "@/pages/seller-dashboard-goals";

describe("getBottleGoalProgress", () => {
  it("uses total sold bottles instead of total orders", () => {
    const progress = getBottleGoalProgress({ totalItems: 24, totalOrders: 9 }, 30);

    expect(progress.achieved).toBe(24);
    expect(progress.goal).toBe(30);
    expect(progress.percentage).toBe(80);
  });

  it("caps percentage at 100", () => {
    const progress = getBottleGoalProgress({ totalItems: 42, totalOrders: 10 }, 30);

    expect(progress.percentage).toBe(100);
  });
});
