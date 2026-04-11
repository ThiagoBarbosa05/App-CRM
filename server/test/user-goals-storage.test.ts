import { describe, expect, it, vi } from "vitest";

import { DatabaseStorage } from "../storage";

describe("DatabaseStorage.getUserGoalsWithResults", () => {
  it("returns ordersGoal and avgBottleValueGoal for dashboard cards", async () => {
    const goalsFromDb = [
      {
        id: "goal-1",
        userId: "user-1",
        salesGoal: "1000.00",
        averageTicket: "100.00",
        ordersGoal: 24,
        avgBottleValueGoal: "42.50",
        month: 4,
        year: 2026,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        userName: "Vendedor 1",
        userEmail: "seller@example.com",
      },
    ];

    const orderByMock = vi.fn(async () => goalsFromDb);
    const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
    const leftJoinSecondMock = vi.fn(() => ({ where: whereMock }));
    const leftJoinFirstMock = vi.fn(() => ({ leftJoin: leftJoinSecondMock }));
    const fromMock = vi.fn(() => ({ leftJoin: leftJoinFirstMock }));
    const selectMock = vi.fn(() => ({ from: fromMock }));

    const storage = new DatabaseStorage();

    Reflect.set(storage, "db", { select: selectMock });

    vi.spyOn(storage, "getWeeklyResultsByGoalId").mockResolvedValue([]);

    const results = await storage.getUserGoalsWithResults(4, 2026);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ordersGoal: 24,
      avgBottleValueGoal: "42.50",
      weeklyResults: [],
    });
  });
});
