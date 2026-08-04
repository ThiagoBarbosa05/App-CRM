import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { closeOrderMock } = vi.hoisted(() => ({ closeOrderMock: vi.fn() }));

vi.mock("../../services/restaurant-pdv.service", () => ({
  restaurantPdvService: { closeOrder: closeOrderMock },
}));

const app = createRouteTestApp({
  router: restaurantPdvRouter,
  basePath: "/restaurant-pdv",
  middlewares: [createMockAuthMiddleware({ role: "garcom", userId: "waiter-1" })],
});

describe("POST /restaurant-pdv/orders/:id/close", () => {
  beforeEach(() => {
    closeOrderMock.mockReset();
    closeOrderMock.mockResolvedValue({ id: "order-1", status: "fechada" });
  });

  it("repassa os pagamentos da divisão de conta em uma única chamada", async () => {
    const payments = [
      { method: "pix", amount: "66.67", payerLabel: "Pessoa 1" },
      { method: "dinheiro", amount: "66.66", payerLabel: "Pessoa 2" },
    ];

    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ payments });

    expect(response.status).toBe(200);
    expect(closeOrderMock).toHaveBeenCalledWith(
      "order-1",
      undefined,
      "waiter-1",
      payments,
      "test-unit-id",
      null,
    );
  });

  it("mantém o fechamento simples com forma de pagamento única", async () => {
    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ paymentMethod: "pix" });

    expect(response.status).toBe(200);
    expect(closeOrderMock).toHaveBeenCalledWith(
      "order-1",
      "pix",
      "waiter-1",
      undefined,
      "test-unit-id",
      null,
    );
  });

  it("repassa a forma de pagamento Bling do fechamento simples", async () => {
    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({
        paymentMethod: "pix",
        blingPaymentMethodId: "12345",
        blingPaymentMethodDescription: "Pix Nubank",
      });

    expect(response.status).toBe(200);
    expect(closeOrderMock).toHaveBeenCalledWith(
      "order-1",
      "pix",
      "waiter-1",
      undefined,
      "test-unit-id",
      { id: "12345", description: "Pix Nubank" },
    );
  });

  it("aceita pagamentos da divisão com forma Bling e método outros", async () => {
    const payments = [
      {
        method: "outros",
        amount: "66.67",
        payerLabel: "Pessoa 1",
        blingPaymentMethodId: "111",
        blingPaymentMethodDescription: "Boleto",
      },
      { method: "dinheiro", amount: "66.66", payerLabel: "Pessoa 2" },
    ];

    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ payments });

    expect(response.status).toBe(200);
    expect(closeOrderMock).toHaveBeenCalledWith(
      "order-1",
      undefined,
      "waiter-1",
      payments,
      "test-unit-id",
      null,
    );
  });

  it("rejeita blingPaymentMethodId não numérico", async () => {
    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ paymentMethod: "pix", blingPaymentMethodId: "abc" });

    expect(response.status).toBe(400);
    expect(closeOrderMock).not.toHaveBeenCalled();
  });

  it("rejeita método de pagamento inválido dentro de payments", async () => {
    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ payments: [{ method: "boleto", amount: "10.00" }] });

    expect(response.status).toBe(400);
    expect(closeOrderMock).not.toHaveBeenCalled();
  });

  it("propaga divergência de soma como 409", async () => {
    closeOrderMock.mockRejectedValue(
      Object.assign(new Error("A soma dos pagamentos não bate"), {
        code: "PAYMENTS_MISMATCH",
      }),
    );

    const response = await request(app)
      .post("/restaurant-pdv/orders/order-1/close")
      .send({ payments: [{ method: "pix", amount: "1.00" }] });

    expect(response.status).toBe(409);
  });
});
