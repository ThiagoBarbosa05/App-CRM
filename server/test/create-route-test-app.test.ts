import express, { Router, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  createRouteTestApp,
  createRouteTestHeaders,
  createRouteTestMiddleware,
} from "./create-route-test-app";
import { rawBodyJson } from "./raw-body-json";

describe("createRouteTestApp", () => {
  it("mounts an isolated router with json parsing and default user headers", async () => {
    const router = Router();

    router.post("/json", (req: Request, res: Response) => {
      res.json({
        body: req.body,
        headers: {
          userId: req.headers["x-user-id"],
          userRole: req.headers["x-user-role"],
        },
      });
    });

    const app = createRouteTestApp({
      router,
      middlewares: [createRouteTestMiddleware()],
    });

    const response = await request(app)
      .post("/json")
      .set(createRouteTestHeaders())
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { ok: true },
      headers: {
        userId: "test-user-id",
        userRole: "admin",
      },
    });
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
