import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { openOrderMock, closeOrderMock } = vi.hoisted(() => ({
  openOrderMock: vi.fn(),
  closeOrderMock: vi.fn(),
}));

vi.mock("../../services/restaurant-pdv.service", () => ({
  restaurantPdvService: { openOrder: openOrderMock, closeOrder: closeOrderMock },
}));

const app = createRouteTestApp({
  router: restaurantPdvRouter,
  basePath: "/restaurant-pdv",
  middlewares: [createMockAuthMiddleware({ role: "garcom", userId: "waiter-1" })],
});

const noCashSession = () =>
  Object.assign(new Error("Nenhum caixa aberto — peça a um gerente para abrir o caixa"), {
    code: "NO_CASH_SESSION",
  });

describe("bloqueio por caixa fechado", () => {
  beforeEach(() => {
    openOrderMock.mockReset();
    closeOrderMock.mockReset();
  });

  it("abrir mesa sem caixa devolve 409 com mensagem acionável", async () => {
    openOrderMock.mockRejectedValue(noCashSession());

    const response = await request(app)
      .post("/restaurant-pdv/orders")
      .send({ tableNumber: 5, peopleCount: 2 });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("peça a um gerente");
  });

  it("fechar comanda sem caixa devolve 409", async () => {
    closeOrderMock.mockRejectedValue(noCashSession());

    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ paymentMethod: "pix" });

    expect(response.status).toBe(409);
  });

  it("com caixa aberto a abertura de mesa segue normal", async () => {
    openOrderMock.mockResolvedValue({ id: "order-1", tableNumber: 5 });

    const response = await request(app)
      .post("/restaurant-pdv/orders")
      .send({ tableNumber: 5, peopleCount: 2 });

    expect(response.status).toBe(201);
  });
});
