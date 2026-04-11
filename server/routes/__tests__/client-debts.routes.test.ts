import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createRouteTestHeaders } from "../../test/create-route-test-app";
import { clientDebtsRouter } from "../client-debts.routes";

const {
  getClientDebtsMock,
  getUsersMock,
  createClientDebtMock,
  updateClientDebtMock,
  deleteClientDebtMock,
} = vi.hoisted(() => ({
  getClientDebtsMock: vi.fn(),
  getUsersMock: vi.fn(),
  createClientDebtMock: vi.fn(),
  updateClientDebtMock: vi.fn(),
  deleteClientDebtMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getClientDebts: getClientDebtsMock,
    getUsers: getUsersMock,
    createClientDebt: createClientDebtMock,
    updateClientDebt: updateClientDebtMock,
    deleteClientDebt: deleteClientDebtMock,
  },
}));

describe("clientDebtsRouter", () => {
  beforeEach(() => {
    getClientDebtsMock.mockReset();
    getUsersMock.mockReset();
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

  it("creates client debt using x-user-id when present", async () => {
    createClientDebtMock.mockResolvedValue({ id: "debt-1" });
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app)
      .post("/client-debts")
      .set(createRouteTestHeaders())
      .send({ clientId: "client-1", amount: "10.00", description: "Debt", dueDate: "2026-04-12" });

    expect(createClientDebtMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "debt-1" });
  });

  it("falls back to first user when x-user-id is missing", async () => {
    getUsersMock.mockResolvedValue([{ id: "fallback-user" }]);
    createClientDebtMock.mockResolvedValue({ id: "debt-1" });
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app)
      .post("/client-debts")
      .send({ clientId: "client-1", amount: "10.00", description: "Debt", dueDate: "2026-04-12" });

    expect(getUsersMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("returns 400 when no users exist for fallback creation", async () => {
    getUsersMock.mockResolvedValue([]);
    const app = createRouteTestApp({ router: clientDebtsRouter, basePath: "/client-debts" });

    const response = await request(app)
      .post("/client-debts")
      .send({ clientId: "client-1", amount: "10.00", description: "Debt", dueDate: "2026-04-12" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "No users found in system" });
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
