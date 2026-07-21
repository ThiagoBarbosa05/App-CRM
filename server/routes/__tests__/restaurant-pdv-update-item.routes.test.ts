import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { updateItemMock } = vi.hoisted(() => ({ updateItemMock: vi.fn() }));

vi.mock("../../services/restaurant-pdv.service", () => ({
  restaurantPdvService: { updateItem: updateItemMock },
}));

function appAs(role: string, userId = "user-1") {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role, userId })],
  });
}

describe("PUT /restaurant-pdv/orders/:id/items/:itemId", () => {
  beforeEach(() => {
    updateItemMock.mockReset();
    updateItemMock.mockResolvedValue({ id: "item-1", unitPrice: "10.00", quantity: 1 });
  });

  it("recusa alteração de preço feita por garçom", async () => {
    const response = await request(appAs("garcom"))
      .put("/restaurant-pdv/orders/order-1/items/item-1")
      .send({ unitPrice: "0.01" });

    expect(response.status).toBe(403);
    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it("permite que garçom altere apenas a quantidade", async () => {
    const response = await request(appAs("garcom"))
      .put("/restaurant-pdv/orders/order-1/items/item-1")
      .send({ quantity: 3 });

    expect(response.status).toBe(200);
    expect(updateItemMock).toHaveBeenCalledWith(
      "order-1",
      "item-1",
      { quantity: 3 },
      "user-1",
    );
  });

  it("permite que gerente altere o preço", async () => {
    const response = await request(appAs("gerente", "gerente-1"))
      .put("/restaurant-pdv/orders/order-1/items/item-1")
      .send({ unitPrice: "5.00" });

    expect(response.status).toBe(200);
    expect(updateItemMock).toHaveBeenCalledWith(
      "order-1",
      "item-1",
      { unitPrice: "5.00" },
      "gerente-1",
    );
  });

  it("repassa o actorId para a auditoria", async () => {
    await request(appAs("admin", "admin-9"))
      .put("/restaurant-pdv/orders/order-1/items/item-1")
      .send({ unitPrice: "5.00", quantity: 2 });

    expect(updateItemMock).toHaveBeenCalledWith(
      "order-1",
      "item-1",
      { unitPrice: "5.00", quantity: 2 },
      "admin-9",
    );
  });
});
