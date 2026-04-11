import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { markerGoalsRouter, markerStatsRouter } from "../marker-goals.routes";

const {
  getMarkerGoalsMock,
  getMarkerGoalsByMonthYearMock,
  createMarkerGoalMock,
  updateMarkerGoalMock,
  deleteMarkerGoalMock,
  getMarkerStatsByPeriodMock,
} = vi.hoisted(() => ({
  getMarkerGoalsMock: vi.fn(),
  getMarkerGoalsByMonthYearMock: vi.fn(),
  createMarkerGoalMock: vi.fn(),
  updateMarkerGoalMock: vi.fn(),
  deleteMarkerGoalMock: vi.fn(),
  getMarkerStatsByPeriodMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getMarkerGoals: getMarkerGoalsMock,
    getMarkerGoalsByMonthYear: getMarkerGoalsByMonthYearMock,
    createMarkerGoal: createMarkerGoalMock,
    updateMarkerGoal: updateMarkerGoalMock,
    deleteMarkerGoal: deleteMarkerGoalMock,
    getMarkerStatsByPeriod: getMarkerStatsByPeriodMock,
  },
}));

describe("marker goal routers", () => {
  beforeEach(() => {
    getMarkerGoalsMock.mockReset();
    getMarkerGoalsByMonthYearMock.mockReset();
    createMarkerGoalMock.mockReset();
    updateMarkerGoalMock.mockReset();
    deleteMarkerGoalMock.mockReset();
    getMarkerStatsByPeriodMock.mockReset();
  });

  it("keeps GET /marker-goals", async () => {
    getMarkerGoalsMock.mockResolvedValue([{ id: "goal-1" }]);
    const app = createRouteTestApp({ router: markerGoalsRouter, basePath: "/marker-goals" });
    const response = await request(app).get("/marker-goals").query({ userId: "u1", userRole: "admin" });

    expect(getMarkerGoalsMock).toHaveBeenCalledWith("u1", "admin");
    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid POST /marker-goals body", async () => {
    const app = createRouteTestApp({ router: markerGoalsRouter, basePath: "/marker-goals" });
    const response = await request(app).post("/marker-goals").send({});

    expect(response.status).toBe(400);
  });

  it("keeps PATCH /marker-goals/:id mapped to update", async () => {
    updateMarkerGoalMock.mockResolvedValue({ id: "goal-1" });
    const app = createRouteTestApp({ router: markerGoalsRouter, basePath: "/marker-goals" });
    const response = await request(app).patch("/marker-goals/goal-1").send({ monthlyGoal: 1 });

    expect(updateMarkerGoalMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("returns 404 for DELETE /marker-goals/:id when storage returns false", async () => {
    deleteMarkerGoalMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: markerGoalsRouter, basePath: "/marker-goals" });
    const response = await request(app).delete("/marker-goals/goal-1");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Meta de marcadores não encontrada" });
  });

  it("keeps GET /marker-stats/:month/:year", async () => {
    getMarkerStatsByPeriodMock.mockResolvedValue({ total: 7 });
    const app = createRouteTestApp({ router: markerStatsRouter, basePath: "/marker-stats" });
    const response = await request(app).get("/marker-stats/4/2026");

    expect(getMarkerStatsByPeriodMock).toHaveBeenCalledWith(4, 2026);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 7 });
  });
});
