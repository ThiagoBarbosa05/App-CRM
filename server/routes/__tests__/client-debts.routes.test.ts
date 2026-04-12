import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { clientDebtsRouter } from "../client-debts.routes";

const {
  getClientDebtsMock,
  createClientDebtMock,
  updateClientDebtMock,
  deleteClientDebtMock,
} = vi.hoisted(() => ({
  getClientDebtsMock: vi.fn(),
  createClientDebtMock: vi.fn(),
  updateClientDebtMock: vi.fn(),
  deleteClientDebtMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getClientDebts: getClientDebtsMock,
    createClientDebt: createClientDebtMock,
    updateClientDebt: updateClientDebtMock,
    deleteClientDebt: deleteClientDebtMock,
  },
}));

describe("clientDebtsRouter", () => {
  beforeEach(() => {
    getClientDebtsMock.mockReset();
    createClientDebtMock.mockReset();
    updateClientDebtMock.mockReset();
    deleteClientDebtMock.mockReset();
  });

  it("keeps GET /client-debts with optional responsibleId", async () => {
    getClientDebtsMock.mockResolvedValue([{ id: "debt-1" }]);
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app).get("/client-debts?responsibleId=user-1");

    expect(getClientDebtsMock).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "debt-1" }]);
  });

  it("creates client debt with responsibleId from jwt", async () => {
    createClientDebtMock.mockResolvedValue({ id: "debt-1" });
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app)
      .post("/client-debts")
      .send({ clientId: "client-1", amount: "10.00", description: "Debt", dueDate: "2026-04-12" });

    expect(createClientDebtMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "debt-1" });
  });

  it("keeps PUT /client-debts/:id", async () => {
    updateClientDebtMock.mockResolvedValue({ id: "debt-1", status: "paid" });
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app)
      .put("/client-debts/debt-1")
      .send({ status: "paid" });

    expect(updateClientDebtMock).toHaveBeenCalledWith("debt-1", { status: "paid" });
    expect(response.status).toBe(200);
  });

  it("keeps DELETE /client-debts/:id", async () => {
    deleteClientDebtMock.mockResolvedValue(undefined);
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app).delete("/client-debts/debt-1");

    expect(deleteClientDebtMock).toHaveBeenCalledWith("debt-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
