import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import {
  clientRegistrationGoalsRouter,
  clientRegistrationStatsRouter,
} from "../client-registration-goals.routes";

const {
  getClientRegistrationGoalsMock,
  getClientRegistrationGoalsByMonthYearMock,
  createClientRegistrationGoalMock,
  updateClientRegistrationGoalMock,
  deleteClientRegistrationGoalMock,
  getClientRegistrationStatsByPeriodMock,
} = vi.hoisted(() => ({
  getClientRegistrationGoalsMock: vi.fn(),
  getClientRegistrationGoalsByMonthYearMock: vi.fn(),
  createClientRegistrationGoalMock: vi.fn(),
  updateClientRegistrationGoalMock: vi.fn(),
  deleteClientRegistrationGoalMock: vi.fn(),
  getClientRegistrationStatsByPeriodMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getClientRegistrationGoals: getClientRegistrationGoalsMock,
    getClientRegistrationGoalsByMonthYear: getClientRegistrationGoalsByMonthYearMock,
    createClientRegistrationGoal: createClientRegistrationGoalMock,
    updateClientRegistrationGoal: updateClientRegistrationGoalMock,
    deleteClientRegistrationGoal: deleteClientRegistrationGoalMock,
    getClientRegistrationStatsByPeriod: getClientRegistrationStatsByPeriodMock,
  },
}));

describe("client registration goal routers", () => {
  beforeEach(() => {
    getClientRegistrationGoalsMock.mockReset();
    getClientRegistrationGoalsByMonthYearMock.mockReset();
    createClientRegistrationGoalMock.mockReset();
    updateClientRegistrationGoalMock.mockReset();
    deleteClientRegistrationGoalMock.mockReset();
    getClientRegistrationStatsByPeriodMock.mockReset();
  });

  it("keeps GET /client-registration-goals using user from jwt", async () => {
    getClientRegistrationGoalsMock.mockResolvedValue([{ id: "goal-1" }]);
    const app = createRouteTestApp({ router: clientRegistrationGoalsRouter, basePath: "/client-registration-goals" });

    const response = await request(app)
      .get("/client-registration-goals");

    expect(getClientRegistrationGoalsMock).toHaveBeenCalledWith("test-user-id", "admin");
    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid POST /client-registration-goals body", async () => {
    const app = createRouteTestApp({ router: clientRegistrationGoalsRouter, basePath: "/client-registration-goals" });
    const response = await request(app).post("/client-registration-goals").send({});

    expect(response.status).toBe(400);
  });

  it("keeps PATCH /client-registration-goals/:id mapped to update", async () => {
    updateClientRegistrationGoalMock.mockResolvedValue({ id: "goal-1" });
    const app = createRouteTestApp({ router: clientRegistrationGoalsRouter, basePath: "/client-registration-goals" });
    const response = await request(app)
      .patch("/client-registration-goals/goal-1")
      .send({ monthlyGoal: 10 });

    expect(updateClientRegistrationGoalMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("returns 404 for DELETE /client-registration-goals/:id when storage returns false", async () => {
    deleteClientRegistrationGoalMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: clientRegistrationGoalsRouter, basePath: "/client-registration-goals" });
    const response = await request(app).delete("/client-registration-goals/goal-1");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Meta de cadastros não encontrada" });
  });

  it("keeps GET /client-registration-stats/:month/:year", async () => {
    getClientRegistrationStatsByPeriodMock.mockResolvedValue({ total: 3 });
    const app = createRouteTestApp({ router: clientRegistrationStatsRouter, basePath: "/client-registration-stats" });
    const response = await request(app).get("/client-registration-stats/4/2026");

    expect(getClientRegistrationStatsByPeriodMock).toHaveBeenCalledWith(4, 2026);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 3 });
  });
});
