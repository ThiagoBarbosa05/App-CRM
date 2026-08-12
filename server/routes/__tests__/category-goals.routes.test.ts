import request from "supertest";
import type { RequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";
import { categoryGoalsRouter } from "../category-goals.routes";

const {
  getCategoryGoalsMock,
  createCategoryGoalMock,
  createCategoryGoalsBulkMock,
  deleteCategoryGoalMock,
} = vi.hoisted(() => ({
  getCategoryGoalsMock: vi.fn(),
  createCategoryGoalMock: vi.fn(),
  createCategoryGoalsBulkMock: vi.fn(),
  deleteCategoryGoalMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getCategoryGoals: getCategoryGoalsMock,
    createCategoryGoal: createCategoryGoalMock,
    createCategoryGoalsBulk: createCategoryGoalsBulkMock,
    deleteCategoryGoal: deleteCategoryGoalMock,
  },
}));

// Ver comentário em winery-goals.routes.test.ts.
vi.mock("../../middleware/validation", () => ({
  requireAuth: ((_req, _res, next) => next()) as RequestHandler,
}));

const buildApp = (overrides?: Parameters<typeof createMockAuthMiddleware>[0]) =>
  createRouteTestApp({
    router: categoryGoalsRouter,
    basePath: "/category-goals",
    middlewares: overrides ? [createMockAuthMiddleware(overrides)] : [],
  });

const goalFor = (userId: string, id: string) => ({
  id,
  userId,
  userName: "Vendedor",
  userEmail: "v@example.com",
  categoryName: "Tinto",
  goalQty: 10,
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  createdAt: "2026-08-01T00:00:00.000Z",
  achieved: 4,
  achievedTotal: 4,
});

describe("category goals router", () => {
  beforeEach(() => {
    getCategoryGoalsMock.mockReset();
    createCategoryGoalMock.mockReset();
    createCategoryGoalsBulkMock.mockReset();
    deleteCategoryGoalMock.mockReset();
  });

  it("passa o período como números para o storage", async () => {
    getCategoryGoalsMock.mockResolvedValue([]);

    const response = await request(buildApp()).get("/category-goals/8/2026");

    expect(response.status).toBe(200);
    expect(getCategoryGoalsMock).toHaveBeenCalledWith({ month: 8, year: 2026 });
  });

  it("rejeita mês inválido com 400", async () => {
    const response = await request(buildApp()).get("/category-goals/13/2026");

    expect(response.status).toBe(400);
    expect(getCategoryGoalsMock).not.toHaveBeenCalled();
  });

  it("gestor recebe as metas de todos os vendedores", async () => {
    getCategoryGoalsMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(buildApp({ role: "admin", userId: "u9" })).get(
      "/category-goals/8/2026",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it("vendedor recebe apenas as próprias metas", async () => {
    getCategoryGoalsMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(
      buildApp({ role: "vendedor", userId: "u2" }),
    ).get("/category-goals/8/2026");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("g2");
  });

  it("bloqueia POST de vendedor com 403", async () => {
    const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
      .post("/category-goals")
      .send({
        userId: "u1",
        categoryName: "Tinto",
        goalQty: 10,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      });

    expect(response.status).toBe(403);
    expect(createCategoryGoalMock).not.toHaveBeenCalled();
  });

  it("bloqueia DELETE de vendedor com 403 sem tocar no storage", async () => {
    const response = await request(
      buildApp({ role: "vendedor", userId: "u1" }),
    ).delete("/category-goals/g1");

    expect(response.status).toBe(403);
    expect(deleteCategoryGoalMock).not.toHaveBeenCalled();
  });

  it("devolve 404 quando o storage não encontra a meta a excluir", async () => {
    deleteCategoryGoalMock.mockResolvedValue(false);

    const response = await request(buildApp()).delete("/category-goals/g1");

    expect(response.status).toBe(404);
  });

  describe("POST /bulk", () => {
    const bulkBody = {
      userIds: ["u1", "u2"],
      categoryName: "Tinto",
      goalQty: 10,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    };

    it("cria a meta para todos os vendedores selecionados", async () => {
      getCategoryGoalsMock.mockResolvedValue([]);
      createCategoryGoalsBulkMock.mockResolvedValue([
        goalFor("u1", "g1"),
        goalFor("u2", "g2"),
      ]);

      const response = await request(buildApp())
        .post("/category-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 2, total: 2, skipped: [] });
      expect(getCategoryGoalsMock).toHaveBeenCalledWith({ month: 8, year: 2026 });
      expect(createCategoryGoalsBulkMock).toHaveBeenCalledWith([
        { userId: "u1", categoryName: "Tinto", goalQty: 10, startDate: "2026-08-01", endDate: "2026-08-31" },
        { userId: "u2", categoryName: "Tinto", goalQty: 10, startDate: "2026-08-01", endDate: "2026-08-31" },
      ]);
    });

    it("pula vendedores que já têm meta para a mesma categoria e período", async () => {
      getCategoryGoalsMock.mockResolvedValue([goalFor("u1", "existing")]);
      createCategoryGoalsBulkMock.mockResolvedValue([goalFor("u2", "g2")]);

      const response = await request(buildApp())
        .post("/category-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 1, total: 2, skipped: ["u1"] });
    });

    it("devolve 400 quando todos os vendedores já têm meta", async () => {
      getCategoryGoalsMock.mockResolvedValue([
        goalFor("u1", "e1"),
        goalFor("u2", "e2"),
      ]);

      const response = await request(buildApp())
        .post("/category-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(400);
      expect(createCategoryGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("bloqueia vendedor com 403 sem tocar no storage", async () => {
      const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
        .post("/category-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(403);
      expect(createCategoryGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("rejeita userIds vazio com 400", async () => {
      const response = await request(buildApp())
        .post("/category-goals/bulk")
        .send({ ...bulkBody, userIds: [] });

      expect(response.status).toBe(400);
      expect(createCategoryGoalsBulkMock).not.toHaveBeenCalled();
    });
  });
});
