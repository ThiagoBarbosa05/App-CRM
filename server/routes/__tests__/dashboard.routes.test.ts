import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { dashboardRouter } from "../dashboard.routes";

const { getDashboardStatsMock } = vi.hoisted(() => ({
  getDashboardStatsMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getDashboardStats: getDashboardStatsMock,
  },
}));

describe("dashboardRouter", () => {
  beforeEach(() => {
    getDashboardStatsMock.mockReset();
  });

  it("keeps GET /dashboard/stats/:userId using only path param", async () => {
    getDashboardStatsMock.mockResolvedValue({ totalClients: 1 });
    const app = createRouteTestApp({ router: dashboardRouter, basePath: "/dashboard" });

    const response = await request(app).get("/dashboard/stats/user-1");

    expect(getDashboardStatsMock).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalClients: 1 });
  });

  it("returns 500 with current error payload when storage fails", async () => {
    getDashboardStatsMock.mockRejectedValue(new Error("db failed"));
    const app = createRouteTestApp({ router: dashboardRouter, basePath: "/dashboard" });

    const response = await request(app).get("/dashboard/stats/user-1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Failed to fetch dashboard stats" });
  });
});
