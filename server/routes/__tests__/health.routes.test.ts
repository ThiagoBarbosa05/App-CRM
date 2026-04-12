import request from "supertest";
import { describe, expect, it } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { healthRouter } from "../health.routes";

describe("healthRouter", () => {
  it("keeps GET /health", async () => {
    const app = createRouteTestApp({ router: healthRouter, basePath: "/health" });
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
