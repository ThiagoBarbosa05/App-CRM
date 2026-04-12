import { Router, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  createRouteTestApp,
  createMockAuthMiddleware,
} from "./create-route-test-app";
import { rawBodyJson } from "./raw-body-json";

describe("createRouteTestApp", () => {
  it("mounts an isolated router with json parsing and injects req.user via mock auth", async () => {
    const router = Router();

    router.post("/json", (req: Request, res: Response) => {
      res.json({
        body: req.body,
        user: {
          userId: req.user?.userId,
          role: req.user?.role,
        },
      });
    });

    const app = createRouteTestApp({ router });

    const response = await request(app)
      .post("/json")
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { ok: true },
      user: {
        userId: "test-user-id",
        role: "admin",
      },
    });
  });

  it("allows custom user via createMockAuthMiddleware override", async () => {
    const router = Router();

    router.get("/me", (req: Request, res: Response) => {
      res.json({ userId: req.user?.userId, role: req.user?.role });
    });

    const app = createRouteTestApp({
      router,
      middlewares: [createMockAuthMiddleware({ userId: "custom-id", role: "vendedor" })],
    });

    const response = await request(app).get("/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "custom-id", role: "vendedor" });
  });

  it("captures rawBody only when enabled", async () => {
    const router = Router();

    router.post("/raw", (req: Request, res: Response) => {
      const requestWithRawBody = req as Request & { rawBody?: Buffer };

      res.json({
        body: req.body,
        rawBody: requestWithRawBody.rawBody?.toString("utf8") ?? null,
      });
    });

    const app = createRouteTestApp({ router, rawBody: true });

    const response = await request(app)
      .post("/raw")
      .set(rawBodyJson().headers)
      .send(rawBodyJson({ hello: "world" }).body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { hello: "world" },
      rawBody: JSON.stringify({ hello: "world" }),
    });
  });
});
