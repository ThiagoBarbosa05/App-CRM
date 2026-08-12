import request from "supertest";
import type { RequestHandler } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockAuthMiddleware,
  createRouteTestApp,
} from "../../test/create-route-test-app";
import { wineryGoalsRouter } from "../winery-goals.routes";

const {
  getWineryGoalsMock,
  createWineryGoalMock,
  createWineryGoalsBulkMock,
  deleteWineryGoalMock,
} = vi.hoisted(() => ({
  getWineryGoalsMock: vi.fn(),
  createWineryGoalMock: vi.fn(),
  createWineryGoalsBulkMock: vi.fn(),
  deleteWineryGoalMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getWineryGoals: getWineryGoalsMock,
    createWineryGoal: createWineryGoalMock,
    createWineryGoalsBulk: createWineryGoalsBulkMock,
    deleteWineryGoal: deleteWineryGoalMock,
  },
}));

// `requireAuth` real exige o cookie `auth_token` e sobrescreveria o req.user
// injetado pelo mock de auth — sem este mock toda requisição daria 401.
vi.mock("../../middleware/validation", () => ({
  requireAuth: ((_req, _res, next) => next()) as RequestHandler,
}));

const buildApp = (overrides?: Parameters<typeof createMockAuthMiddleware>[0]) =>
  createRouteTestApp({
    router: wineryGoalsRouter,
    basePath: "/winery-goals",
    middlewares: overrides ? [createMockAuthMiddleware(overrides)] : [],
  });

const goalFor = (userId: string, id: string) => ({
  id,
  userId,
  userName: "Vendedor",
  userEmail: "v@example.com",
  wineryName: "Malbec",
  goalQty: 10,
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  createdAt: "2026-08-01T00:00:00.000Z",
  achieved: 4,
  achievedTotal: 4,
});

describe("winery goals router", () => {
  beforeEach(() => {
    getWineryGoalsMock.mockReset();
    createWineryGoalMock.mockReset();
    createWineryGoalsBulkMock.mockReset();
    deleteWineryGoalMock.mockReset();
  });

  it("passa o período como números para o storage", async () => {
    getWineryGoalsMock.mockResolvedValue([]);

    const response = await request(buildApp()).get("/winery-goals/8/2026");

    expect(response.status).toBe(200);
    expect(getWineryGoalsMock).toHaveBeenCalledWith({ month: 8, year: 2026 });
  });

  it("rejeita mês inválido com 400", async () => {
    const response = await request(buildApp()).get("/winery-goals/13/2026");

    expect(response.status).toBe(400);
    expect(getWineryGoalsMock).not.toHaveBeenCalled();
  });

  it("gestor recebe as metas de todos os vendedores", async () => {
    getWineryGoalsMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(buildApp({ role: "gerente", userId: "u9" })).get(
      "/winery-goals/8/2026",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it("vendedor recebe apenas as próprias metas", async () => {
    getWineryGoalsMock.mockResolvedValue([
      goalFor("u1", "g1"),
      goalFor("u2", "g2"),
    ]);

    const response = await request(
      buildApp({ role: "vendedor", userId: "u1" }),
    ).get("/winery-goals/8/2026");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("g1");
  });

  it("bloqueia POST de vendedor com 403", async () => {
    const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
      .post("/winery-goals")
      .send({
        userId: "u1",
        wineryName: "Malbec",
        goalQty: 10,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      });

    expect(response.status).toBe(403);
    expect(createWineryGoalMock).not.toHaveBeenCalled();
  });

  it("bloqueia DELETE de vendedor com 403 sem tocar no storage", async () => {
    const response = await request(
      buildApp({ role: "vendedor", userId: "u1" }),
    ).delete("/winery-goals/g1");

    expect(response.status).toBe(403);
    expect(deleteWineryGoalMock).not.toHaveBeenCalled();
  });

  it("devolve 404 quando o storage não encontra a meta a excluir", async () => {
    deleteWineryGoalMock.mockResolvedValue(false);

    const response = await request(buildApp()).delete("/winery-goals/g1");

    expect(response.status).toBe(404);
  });

  describe("POST /bulk", () => {
    const bulkBody = {
      userIds: ["u1", "u2"],
      wineryName: "Malbec",
      goalQty: 10,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    };

    it("cria a meta para todos os vendedores selecionados", async () => {
      getWineryGoalsMock.mockResolvedValue([]);
      createWineryGoalsBulkMock.mockResolvedValue([
        goalFor("u1", "g1"),
        goalFor("u2", "g2"),
      ]);

      const response = await request(buildApp())
        .post("/winery-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 2, total: 2, skipped: [] });
      expect(getWineryGoalsMock).toHaveBeenCalledWith({ month: 8, year: 2026 });
      expect(createWineryGoalsBulkMock).toHaveBeenCalledWith([
        { userId: "u1", wineryName: "Malbec", goalQty: 10, startDate: "2026-08-01", endDate: "2026-08-31" },
        { userId: "u2", wineryName: "Malbec", goalQty: 10, startDate: "2026-08-01", endDate: "2026-08-31" },
      ]);
    });

    it("pula vendedores que já têm meta para a mesma vinícola e período", async () => {
      getWineryGoalsMock.mockResolvedValue([goalFor("u1", "existing")]);
      createWineryGoalsBulkMock.mockResolvedValue([goalFor("u2", "g2")]);

      const response = await request(buildApp())
        .post("/winery-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ created: 1, total: 2, skipped: ["u1"] });
    });

    it("devolve 400 quando todos os vendedores já têm meta", async () => {
      getWineryGoalsMock.mockResolvedValue([
        goalFor("u1", "e1"),
        goalFor("u2", "e2"),
      ]);

      const response = await request(buildApp())
        .post("/winery-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(400);
      expect(createWineryGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("bloqueia vendedor com 403 sem tocar no storage", async () => {
      const response = await request(buildApp({ role: "vendedor", userId: "u1" }))
        .post("/winery-goals/bulk")
        .send(bulkBody);

      expect(response.status).toBe(403);
      expect(createWineryGoalsBulkMock).not.toHaveBeenCalled();
    });

    it("rejeita userIds vazio com 400", async () => {
      const response = await request(buildApp())
        .post("/winery-goals/bulk")
        .send({ ...bulkBody, userIds: [] });

      expect(response.status).toBe(400);
      expect(createWineryGoalsBulkMock).not.toHaveBeenCalled();
    });
  });
});
