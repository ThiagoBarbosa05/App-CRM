import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { retryMock, authorizeDefaultMock } = vi.hoisted(() => ({
  retryMock: vi.fn(),
  authorizeDefaultMock: vi.fn(),
}));

vi.mock("../../services/bling-sales-order.service", () => ({
  retryBlingSalesOrderSync: retryMock,
  authorizeDefaultBlingContact: authorizeDefaultMock,
  // O router importa o scheduler? Não — mas o service é importado por outros
  // módulos do router, então o mock precisa cobrir a superfície usada.
  sendOrderToBling: vi.fn(),
  MAX_SYNC_ATTEMPTS: 5,
}));

function appAs(role: string, pdvUnitId?: string | null) {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role, userId: "gestor-1", pdvUnitId })],
  });
}

const PATH = "/restaurant-pdv/admin/orders/order-1/retry-bling-sync";

describe("POST /admin/orders/:id/retry-bling-sync", () => {
  beforeEach(() => {
    retryMock.mockReset().mockResolvedValue({
      action: "reenviado",
      order: { id: "order-1", blingSyncStatus: "enviado" },
    });
  });

  it("gestor reenvia e recebe a comanda atualizada", async () => {
    const response = await request(appAs("admin")).post(PATH);

    expect(response.status).toBe(200);
    expect(response.body.action).toBe("reenviado");
    expect(retryMock).toHaveBeenCalledWith("order-1");
  });

  it("comanda já enviada devolve ação de conferência", async () => {
    retryMock.mockResolvedValue({
      action: "conferido",
      order: { id: "order-1", blingCheckStatus: "ok" },
    });

    const response = await request(appAs("gerente")).post(PATH);

    expect(response.status).toBe(200);
    expect(response.body.action).toBe("conferido");
  });

  /**
   * A rota fica acima do `resolvePdvUnit` de propósito: a tela de pendências é
   * cross-unidade, e sem isto um gestor sem unidade selecionada levaria 400
   * num endpoint em que o `:id` já basta.
   */
  it("funciona sem unidade PDV resolvida", async () => {
    const response = await request(appAs("admin", null)).post(PATH);

    expect(response.status).toBe(200);
    expect(retryMock).toHaveBeenCalled();
  });

  it.each(["garcom", "vendedor"])("%s não pode reenviar", async (role) => {
    const response = await request(appAs(role)).post(PATH);

    expect(response.status).toBe(403);
    expect(retryMock).not.toHaveBeenCalled();
  });

  it("comanda inexistente devolve 404", async () => {
    retryMock.mockRejectedValue(
      Object.assign(new Error("Comanda não encontrada"), { code: "NOT_FOUND" }),
    );

    const response = await request(appAs("admin")).post(PATH);

    expect(response.status).toBe(404);
  });

  it("comanda ainda aberta devolve 409", async () => {
    retryMock.mockRejectedValue(
      Object.assign(new Error("Só comanda fechada gera pedido de venda no Bling"), {
        code: "ORDER_NOT_CLOSED",
      }),
    );

    const response = await request(appAs("admin")).post(PATH);

    expect(response.status).toBe(409);
  });

  it("falha inesperada não vaza detalhe interno", async () => {
    retryMock.mockRejectedValue(new Error("connection refused em 10.0.0.5"));

    const response = await request(appAs("admin")).post(PATH);

    expect(response.status).toBe(500);
    expect(response.body.message).not.toContain("10.0.0.5");
  });
});

describe("POST /admin/orders/:id/use-default-bling-contact", () => {
  const fallbackPath = "/restaurant-pdv/admin/orders/order-1/use-default-bling-contact";

  beforeEach(() => {
    authorizeDefaultMock.mockReset().mockResolvedValue({
      id: "order-1",
      blingContactResolution: "consumidor_final",
    });
  });

  it("registra motivo e ator do fallback", async () => {
    const response = await request(appAs("gerente"))
      .post(fallbackPath)
      .send({ reason: "Cliente sem documento válido" });

    expect(response.status).toBe(200);
    expect(authorizeDefaultMock).toHaveBeenCalledWith(
      "order-1",
      "gestor-1",
      "Cliente sem documento válido",
    );
  });

  it("recusa operador sem perfil de gestor", async () => {
    const response = await request(appAs("garcom"))
      .post(fallbackPath)
      .send({ reason: "Cliente sem documento válido" });

    expect(response.status).toBe(403);
    expect(authorizeDefaultMock).not.toHaveBeenCalled();
  });

  it("exige motivo auditável", async () => {
    const response = await request(appAs("admin"))
      .post(fallbackPath)
      .send({ reason: "" });

    expect(response.status).toBe(400);
    expect(authorizeDefaultMock).not.toHaveBeenCalled();
  });

  it("impede fallback quando o pedido já existe", async () => {
    authorizeDefaultMock.mockRejectedValue(
      Object.assign(new Error("O pedido já existe no Bling"), {
        code: "BLING_ORDER_EXISTS",
      }),
    );

    const response = await request(appAs("admin"))
      .post(fallbackPath)
      .send({ reason: "Cliente recusado pelo Bling" });

    expect(response.status).toBe(409);
  });
});
