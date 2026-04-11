import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import {
  interactionGoalsRouter,
  interactionStatsRouter,
} from "../interaction-goals.routes";

const {
  getInteractionGoalsMock,
  getInteractionGoalsByMonthYearMock,
  createInteractionGoalMock,
  updateInteractionGoalMock,
  deleteInteractionGoalMock,
  getInteractionStatsByPeriodMock,
} = vi.hoisted(() => ({
  getInteractionGoalsMock: vi.fn(),
  getInteractionGoalsByMonthYearMock: vi.fn(),
  createInteractionGoalMock: vi.fn(),
  updateInteractionGoalMock: vi.fn(),
  deleteInteractionGoalMock: vi.fn(),
  getInteractionStatsByPeriodMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getInteractionGoals: getInteractionGoalsMock,
    getInteractionGoalsByMonthYear: getInteractionGoalsByMonthYearMock,
    createInteractionGoal: createInteractionGoalMock,
    updateInteractionGoal: updateInteractionGoalMock,
    deleteInteractionGoal: deleteInteractionGoalMock,
    getInteractionStatsByPeriod: getInteractionStatsByPeriodMock,
  },
}));

describe("interaction goal routers", () => {
  beforeEach(() => {
    getInteractionGoalsMock.mockReset();
    getInteractionGoalsByMonthYearMock.mockReset();
    createInteractionGoalMock.mockReset();
    updateInteractionGoalMock.mockReset();
    deleteInteractionGoalMock.mockReset();
    getInteractionStatsByPeriodMock.mockReset();
  });

  it("keeps GET /interaction-goals", async () => {
    getInteractionGoalsMock.mockResolvedValue([{ id: "goal-1" }]);
    const app = createRouteTestApp({ router: interactionGoalsRouter, basePath: "/interaction-goals" });
    const response = await request(app).get("/interaction-goals").query({ userId: "u1", userRole: "admin" });

    expect(getInteractionGoalsMock).toHaveBeenCalledWith("u1", "admin");
    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid POST /interaction-goals body", async () => {
    const app = createRouteTestApp({ router: interactionGoalsRouter, basePath: "/interaction-goals" });
    const response = await request(app).post("/interaction-goals").send({});

    expect(response.status).toBe(400);
  });

  it("keeps PATCH /interaction-goals/:id mapped to update", async () => {
    updateInteractionGoalMock.mockResolvedValue({ id: "goal-1" });
    const app = createRouteTestApp({ router: interactionGoalsRouter, basePath: "/interaction-goals" });
    const response = await request(app).patch("/interaction-goals/goal-1").send({ monthlyGoal: 1 });

    expect(updateInteractionGoalMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("returns 404 for DELETE /interaction-goals/:id when storage returns false", async () => {
    deleteInteractionGoalMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: interactionGoalsRouter, basePath: "/interaction-goals" });
    const response = await request(app).delete("/interaction-goals/goal-1");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Meta de interações não encontrada" });
  });

  it("keeps GET /interaction-stats/:month/:year", async () => {
    getInteractionStatsByPeriodMock.mockResolvedValue({ total: 9 });
    const app = createRouteTestApp({ router: interactionStatsRouter, basePath: "/interaction-stats" });
    const response = await request(app).get("/interaction-stats/4/2026");

    expect(getInteractionStatsByPeriodMock).toHaveBeenCalledWith(4, 2026);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 9 });
  });
});
