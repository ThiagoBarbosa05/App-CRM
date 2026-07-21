import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { listOrdersMock } = vi.hoisted(() => ({ listOrdersMock: vi.fn() }));

vi.mock("../../services/restaurant-pdv.service", () => ({
  restaurantPdvService: { listOrders: listOrdersMock },
}));

function appAs(role: string, userId = "user-1") {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role, userId })],
  });
}

describe("GET /restaurant-pdv/orders", () => {
  beforeEach(() => {
    listOrdersMock.mockReset();
    listOrdersMock.mockResolvedValue([]);
  });

  it("repassa o status cancelada para o serviço", async () => {
    const response = await request(appAs("gerente")).get(
      "/restaurant-pdv/orders?status=cancelada",
    );

    expect(response.status).toBe(200);
    expect(listOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelada" }),
    );
  });

  it("aceita os quatro status do enum de comandas", async () => {
    for (const status of ["aberta", "fechada", "cancelada", "mesclada"]) {
      const response = await request(appAs("gerente")).get(
        `/restaurant-pdv/orders?status=${status}`,
      );
      expect(response.status).toBe(200);
    }
  });

  /**
   * O cast direto de `req.query.status` fazia um valor inválido virar uma
   * cláusula que não casa com nada: 200 e lista vazia, igual a "não há
   * comandas". O filtro parecia funcionar e escondia o erro de quem chamou.
   */
  it("recusa status fora do enum em vez de devolver lista vazia", async () => {
    const response = await request(appAs("gerente")).get(
      "/restaurant-pdv/orders?status=todas",
    );

    expect(response.status).toBe(400);
    expect(listOrdersMock).not.toHaveBeenCalled();
  });

  it("lista sem filtro de status quando o parâmetro é omitido", async () => {
    const response = await request(appAs("gerente")).get("/restaurant-pdv/orders");

    expect(response.status).toBe(200);
    expect(listOrdersMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });

  it("nega acesso ao garçom", async () => {
    const response = await request(appAs("garcom")).get("/restaurant-pdv/orders");

    expect(response.status).toBe(403);
    expect(listOrdersMock).not.toHaveBeenCalled();
  });
});
