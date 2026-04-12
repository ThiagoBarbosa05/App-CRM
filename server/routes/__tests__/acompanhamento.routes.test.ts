import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { acompanhamentoRouter } from "../acompanhamento.routes";

const { getAcompanhamentoDataMock } = vi.hoisted(() => ({
  getAcompanhamentoDataMock: vi.fn(),
}));

vi.mock("../../services/acompanhamento.service", () => ({
  getAcompanhamentoData: getAcompanhamentoDataMock,
}));

describe("acompanhamentoRouter", () => {
  beforeEach(() => {
    getAcompanhamentoDataMock.mockReset();
  });

  it("serves admin flow with stats and pagination", async () => {
    getAcompanhamentoDataMock.mockResolvedValue({
      clients: [{ id: "client-1", name: "Cliente 1" }],
      stats: { totalPendentes: 1, criticos: 0, alta: 0, media: 0, normal: 1, produtividade: 90, totalInteracoes: 4, mediaInteracoes: "2.0" },
      pagination: { currentPage: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
    });

    const app = createRouteTestApp({
      router: acompanhamentoRouter,
      basePath: "/acompanhamento",
      middlewares: [createMockAuthMiddleware({ userId: "admin-id", role: "admin" })],
    });

    const response = await request(app).get("/acompanhamento?page=1&pageSize=10");

    expect(getAcompanhamentoDataMock).toHaveBeenCalledWith({
      userId: "admin-id",
      userRole: "admin",
      searchQuery: undefined,
      page: 1,
      pageSize: 10,
    });
    expect(response.status).toBe(200);
    expect(response.body.stats).toEqual({
      totalPendentes: 1,
      criticos: 0,
      alta: 0,
      media: 0,
      normal: 1,
      produtividade: 90,
      totalInteracoes: 4,
      mediaInteracoes: "2.0",
    });
    expect(response.body.pagination).toEqual({
      currentPage: 1,
      pageSize: 10,
      totalPages: 1,
      totalItems: 1,
    });
  });

  it("serves non-admin flow and preserves fallback pagination parsing", async () => {
    getAcompanhamentoDataMock.mockResolvedValue({
      clients: [],
      stats: { totalPendentes: 0, criticos: 0, alta: 0, media: 0, normal: 0, produtividade: 100, totalInteracoes: 0, mediaInteracoes: "0" },
      pagination: { currentPage: 1, pageSize: 10, totalPages: 0, totalItems: 0 },
    });

    const app = createRouteTestApp({
      router: acompanhamentoRouter,
      basePath: "/acompanhamento",
      middlewares: [createMockAuthMiddleware({ userId: "seller-id", role: "vendedor" })],
    });

    const response = await request(app).get("/acompanhamento?page=0&pageSize=0&search=ana");

    expect(getAcompanhamentoDataMock).toHaveBeenCalledWith({
      userId: "seller-id",
      userRole: "vendedor",
      searchQuery: "ana",
      page: 1,
      pageSize: 10,
    });
    expect(response.status).toBe(200);
  });

  it("returns 500 when the service fails", async () => {
    getAcompanhamentoDataMock.mockRejectedValue(new Error("db failed"));

    const app = createRouteTestApp({ router: acompanhamentoRouter, basePath: "/acompanhamento" });

    const response = await request(app).get("/acompanhamento");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erro ao buscar dados de acompanhamento" });
  });
});
