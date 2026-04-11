import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import {
  telemarketingGoalsRouter,
  telemarketingStatsRouter,
} from "../telemarketing-goals.routes";

const {
  getTelemarketingGoalsControllerMock,
  getTelemarketingGoalsByPeriodControllerMock,
  postTelemarketingGoalControllerMock,
  putTelemarketingGoalControllerMock,
  deleteTelemarketingGoalControllerMock,
  getTelemarketingStatsByPeriodMock,
} = vi.hoisted(() => ({
  getTelemarketingGoalsControllerMock: vi.fn(),
  getTelemarketingGoalsByPeriodControllerMock: vi.fn(),
  postTelemarketingGoalControllerMock: vi.fn(),
  putTelemarketingGoalControllerMock: vi.fn(),
  deleteTelemarketingGoalControllerMock: vi.fn(),
  getTelemarketingStatsByPeriodMock: vi.fn(),
}));

vi.mock("../../controllers/telemarketing-goals/index", () => ({
  getTelemarketingGoalsController: getTelemarketingGoalsControllerMock,
  getTelemarketingGoalsByPeriodController: getTelemarketingGoalsByPeriodControllerMock,
  postTelemarketingGoalController: postTelemarketingGoalControllerMock,
  putTelemarketingGoalController: putTelemarketingGoalControllerMock,
  deleteTelemarketingGoalController: deleteTelemarketingGoalControllerMock,
}));

vi.mock("../../storage", () => ({
  storage: {
    getTelemarketingStatsByPeriod: getTelemarketingStatsByPeriodMock,
  },
}));

describe("telemarketing goal routers", () => {
  beforeEach(() => {
    getTelemarketingGoalsControllerMock.mockReset();
    getTelemarketingGoalsByPeriodControllerMock.mockReset();
    postTelemarketingGoalControllerMock.mockReset();
    putTelemarketingGoalControllerMock.mockReset();
    deleteTelemarketingGoalControllerMock.mockReset();
    getTelemarketingStatsByPeriodMock.mockReset();

    getTelemarketingGoalsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "telemarketing-goals" });
    });
    getTelemarketingGoalsByPeriodControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "telemarketing-goals-period" });
    });
    postTelemarketingGoalControllerMock.mockImplementation((_req, res) => {
      res.status(201).json({ route: "telemarketing-goals-post" });
    });
    putTelemarketingGoalControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "telemarketing-goals-put" });
    });
    deleteTelemarketingGoalControllerMock.mockImplementation((_req, res) => {
      res.status(404).json({ message: "Meta de telemarketing não encontrada" });
    });
  });

  it("keeps GET /telemarketing-goals", async () => {
    const app = createRouteTestApp({ router: telemarketingGoalsRouter, basePath: "/telemarketing-goals" });
    const response = await request(app).get("/telemarketing-goals");

    expect(getTelemarketingGoalsControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("keeps PATCH /telemarketing-goals/:id mapped to update controller", async () => {
    const app = createRouteTestApp({ router: telemarketingGoalsRouter, basePath: "/telemarketing-goals" });
    const response = await request(app).patch("/telemarketing-goals/goal-1").send({ monthlyGoal: 10 });

    expect(putTelemarketingGoalControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("keeps DELETE /telemarketing-goals/:id behavior", async () => {
    const app = createRouteTestApp({ router: telemarketingGoalsRouter, basePath: "/telemarketing-goals" });
    const response = await request(app).delete("/telemarketing-goals/goal-1");

    expect(deleteTelemarketingGoalControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(404);
  });

  it("keeps GET /telemarketing-stats/:month/:year", async () => {
    getTelemarketingStatsByPeriodMock.mockResolvedValue({ total: 5 });
    const app = createRouteTestApp({ router: telemarketingStatsRouter, basePath: "/telemarketing-stats" });
    const response = await request(app).get("/telemarketing-stats/4/2026");

    expect(getTelemarketingStatsByPeriodMock).toHaveBeenCalledWith(4, 2026);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ total: 5 });
  });
});
