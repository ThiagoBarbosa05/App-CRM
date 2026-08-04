import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { listBlingPaymentMethodsMock } = vi.hoisted(() => ({
  listBlingPaymentMethodsMock: vi.fn(),
}));

vi.mock("../../services/pdv-units.service", () => ({
  pdvUnitsService: { listBlingPaymentMethods: listBlingPaymentMethodsMock },
}));

const app = createRouteTestApp({
  router: restaurantPdvRouter,
  basePath: "/restaurant-pdv",
  middlewares: [createMockAuthMiddleware({ role: "garcom", userId: "waiter-1" })],
});

describe("GET /restaurant-pdv/bling-payment-methods", () => {
  beforeEach(() => {
    listBlingPaymentMethodsMock.mockReset();
  });

  it("lista as formas ativas da conta Bling da unidade", async () => {
    const formas = [
      { id: 111, descricao: "Pix Nubank", tipoPagamento: 17, situacao: 1 },
      { id: 222, descricao: "Dinheiro", tipoPagamento: 1, situacao: 1 },
    ];
    listBlingPaymentMethodsMock.mockResolvedValue(formas);

    const response = await request(app).get("/restaurant-pdv/bling-payment-methods");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(formas);
    expect(listBlingPaymentMethodsMock).toHaveBeenCalledWith("test-unit-id");
  });

  it("responde 409 quando a unidade não tem conta Bling vinculada", async () => {
    listBlingPaymentMethodsMock.mockRejectedValue(
      Object.assign(new Error("Unidade sem conta Bling vinculada"), {
        code: "NO_BLING_CONNECTION",
      }),
    );

    const response = await request(app).get("/restaurant-pdv/bling-payment-methods");

    expect(response.status).toBe(409);
  });

  it("responde 409 quando a conexão está sem token", async () => {
    listBlingPaymentMethodsMock.mockRejectedValue(
      Object.assign(new Error("Conta Bling sem token de acesso"), {
        code: "NO_BLING_TOKEN",
      }),
    );

    const response = await request(app).get("/restaurant-pdv/bling-payment-methods");

    expect(response.status).toBe(409);
  });

  it("responde 502 quando a API do Bling falha", async () => {
    listBlingPaymentMethodsMock.mockRejectedValue(
      new Error("Falha ao listar formas de pagamento do Bling: timeout"),
    );

    const response = await request(app).get("/restaurant-pdv/bling-payment-methods");

    expect(response.status).toBe(502);
  });
});
