import request from "supertest";
import type { RequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";
import { productGoalsRouter } from "../product-goals.routes";

const {
  getProductGoalsByPeriodMock,
  createProductGoalMock,
  createProductGoalsBulkMock,
  deleteProductGoalMock,
} = vi.hoisted(() => ({
  getProductGoalsByPeriodMock: vi.fn(),
  createProductGoalMock: vi.fn(),
  createProductGoalsBulkMock: vi.fn(),
  deleteProductGoalMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getProductGoalsByPeriod: getProductGoalsByPeriodMock,
    createProductGoal: createProductGoalMock,
    createProductGoalsBulk: createProductGoalsBulkMock,
    deleteProductGoal: deleteProductGoalMock,
  },
}));

// Ver comentário em winery-goals.routes.test.ts.
vi.mock("../../middleware/validation", () => ({
  requireAuth: ((_req, _res, next) => next()) as RequestHandler,
}));

const buildApp = (overrides?: Parameters<typeof createMockAuthMiddleware>[0]) =>
  createRouteTestApp({
    router: productGoalsRouter,
    basePath: "/product-goals",
    middlewares: overrides ? [createMockAuthMiddleware(overrides)] : [],
  });

const goalFor = (userId: string, id: string) => ({
  id,
  userId,
  month: 8,
  year: 2026,
  productId: "p1",
  productName: "Malbec Reserva",
  productGoalQty: 10,
  achieved: 3,
});

describe("product goals router", () => {
  beforeEach(() => {
    getProductGoalsByPeriodMock.mockReset();
    createProductGoalMock.mockReset();
    createProductGoalsBulkMock.mockReset();
    deleteProductGoalMock.mockReset();
  });

  it("passa o período como números para o storage", async () => {
    getProductGoalsByPeriodMock.mockResolvedValue([]);

    const response = await request(buildApp()).get("/product-goals/8/2026");

    expect(response.status).toBe(200);
    expect(getProductGoalsByPeriodMock).toHaveBeenCalledWith(8, 2026);
  });

  it("rejeita mês inválido com 400", async () => {
    const response = await request(buildApp()).get("/product-goals/47/2026");

    expect(response.status).toBe(400);
    expect(getProductGoalsByPeriodMock).not.toHaveBeenCalled();
  });

  it("gestor recebe as metas de todos os vendedores", async () => {
    getProductGoalsByPeriodMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(
      buildApp({ role: "administrador", userId: "u9" }),
    ).get("/product-goals/8/2026");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it("vendedor recebe apenas as próprias metas", async () => {
    getProductGoalsByPeriodMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(
      buildApp({ role: "vendedor", userId: "u1" }),
    ).get("/product-goals/8/2026");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("g1");
  });

  it("bloqueia POST de vendedor com 403", async () => {
    const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
      .post("/product-goals")
      .send({
        userId: "u1",
        month: 8,
        year: 2026,
        productId: "p1",
        productGoalQty: 10,
      });

    expect(response.status).toBe(403);
    expect(createProductGoalMock).not.toHaveBeenCalled();
  });

  it("bloqueia DELETE de vendedor com 403 sem tocar no storage", async () => {
    const response = await request(
      buildApp({ role: "vendedor", userId: "u1" }),
    ).delete("/product-goals/g1");

    expect(response.status).toBe(403);
    expect(deleteProductGoalMock).not.toHaveBeenCalled();
  });

  it("devolve 404 quando o storage não encontra a meta a excluir", async () => {
    deleteProductGoalMock.mockResolvedValue(false);

    const response = await request(buildApp()).delete("/product-goals/g1");

    expect(response.status).toBe(404);
  });

  describe("POST /bulk", () => {
    it("cria a meta para todos os vendedores selecionados", async () => {
      getProductGoalsByPeriodMock.mockResolvedValue([]);
      createProductGoalsBulkMock.mockResolvedValue([
        goalFor("u1", "g1"),
        goalFor("u2", "g2"),
      ]);

      const response = await request(buildApp())
        .post("/product-goals/bulk")
        .send({
          userIds: ["u1", "u2"],
          month: 8,
          year: 2026,
          productId: "p1",
          productGoalQty: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 2, total: 2, skipped: [] });
      expect(createProductGoalsBulkMock).toHaveBeenCalledWith([
        { userId: "u1", month: 8, year: 2026, productId: "p1", productGoalQty: 10 },
        { userId: "u2", month: 8, year: 2026, productId: "p1", productGoalQty: 10 },
      ]);
    });

    it("pula vendedores que já têm meta para o mesmo produto e período", async () => {
      getProductGoalsByPeriodMock.mockResolvedValue([goalFor("u1", "existing")]);
      createProductGoalsBulkMock.mockResolvedValue([goalFor("u2", "g2")]);

      const response = await request(buildApp())
        .post("/product-goals/bulk")
        .send({
          userIds: ["u1", "u2"],
          month: 8,
          year: 2026,
          productId: "p1",
          productGoalQty: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 1, total: 2, skipped: ["u1"] });
      expect(createProductGoalsBulkMock).toHaveBeenCalledWith([
        { userId: "u2", month: 8, year: 2026, productId: "p1", productGoalQty: 10 },
      ]);
    });

    it("devolve 400 quando todos os vendedores já têm meta", async () => {
      getProductGoalsByPeriodMock.mockResolvedValue([goalFor("u1", "existing")]);

      const response = await request(buildApp())
        .post("/product-goals/bulk")
        .send({
          userIds: ["u1"],
          month: 8,
          year: 2026,
          productId: "p1",
          productGoalQty: 10,
        });

      expect(response.status).toBe(400);
      expect(createProductGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("bloqueia vendedor com 403 sem tocar no storage", async () => {
      const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
        .post("/product-goals/bulk")
        .send({
          userIds: ["u1"],
          month: 8,
          year: 2026,
          productId: "p1",
          productGoalQty: 10,
        });

      expect(response.status).toBe(403);
      expect(createProductGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("rejeita userIds vazio com 400", async () => {
      const response = await request(buildApp())
        .post("/product-goals/bulk")
        .send({ userIds: [], month: 8, year: 2026, productId: "p1", productGoalQty: 10 });

      expect(response.status).toBe(400);
      expect(createProductGoalsBulkMock).not.toHaveBeenCalled();
    });
  });
});
