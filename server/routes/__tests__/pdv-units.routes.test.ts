import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { createUnitMock, updateUnitMock, listUnitsWithCatalogMock, getConnectionMock } =
  vi.hoisted(() => ({
    createUnitMock: vi.fn(),
    updateUnitMock: vi.fn(),
    listUnitsWithCatalogMock: vi.fn(),
    getConnectionMock: vi.fn(),
  }));

vi.mock("../../services/pdv-units.service", () => ({
  pdvUnitsService: {
    createUnit: createUnitMock,
    updateUnit: updateUnitMock,
    listUnitsWithCatalog: listUnitsWithCatalogMock,
    listUnits: vi.fn(),
    getUnit: vi.fn(),
    deactivateUnit: vi.fn(),
  },
}));

vi.mock("../../services/bling-connections.service", () => ({
  blingConnectionsService: { getById: getConnectionMock },
}));

function appAs(role: string) {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role })],
  });
}

const CONNECTED = { id: "conn-1", status: "connected", name: "Bling Matriz" };

beforeEach(() => {
  createUnitMock.mockReset().mockResolvedValue({ id: "unit-1" });
  updateUnitMock.mockReset().mockResolvedValue({ id: "unit-1" });
  listUnitsWithCatalogMock.mockReset().mockResolvedValue([]);
  getConnectionMock.mockReset().mockResolvedValue(CONNECTED);
});

describe("POST /restaurant-pdv/units", () => {
  /**
   * O campo não existia no schema Zod do controller, então o vínculo escolhido
   * pelo admin era descartado silenciosamente e toda unidade nascia sem catálogo.
   */
  it("persiste o blingConnectionId escolhido", async () => {
    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: "conn-1" });

    expect(response.status).toBe(201);
    expect(createUnitMock).toHaveBeenCalledWith(
      expect.objectContaining({ blingConnectionId: "conn-1" }),
    );
  });

  it("aceita null como 'sem catálogo Bling' sem consultar a conexão", async () => {
    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: null });

    expect(response.status).toBe(201);
    expect(getConnectionMock).not.toHaveBeenCalled();
    expect(createUnitMock).toHaveBeenCalledWith(
      expect.objectContaining({ blingConnectionId: null }),
    );
  });

  it("recusa conexão inexistente", async () => {
    getConnectionMock.mockResolvedValue(null);

    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: "conn-fantasma" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Conta Bling não encontrada");
    expect(createUnitMock).not.toHaveBeenCalled();
  });

  /**
   * O dropdown só oferece contas 'connected', mas a conta pode ser revogada com o
   * modal aberto — e uma conexão morta vira catálogo vazio no PDV, sem erro visível.
   */
  it("recusa conexão que não está conectada", async () => {
    getConnectionMock.mockResolvedValue({ ...CONNECTED, status: "expired" });

    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: "conn-1" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Conta Bling não está conectada");
    expect(createUnitMock).not.toHaveBeenCalled();
  });

  it("nega acesso ao garçom", async () => {
    const response = await request(appAs("garcom"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz" });

    expect(response.status).toBe(403);
    expect(createUnitMock).not.toHaveBeenCalled();
  });
});

describe("PUT /restaurant-pdv/units/:id", () => {
  it("persiste o blingConnectionId ao editar", async () => {
    const response = await request(appAs("gerente"))
      .put("/restaurant-pdv/units/unit-1")
      .send({ blingConnectionId: "conn-1" });

    expect(response.status).toBe(200);
    expect(updateUnitMock).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ blingConnectionId: "conn-1" }),
    );
  });

  it("desvincula o catálogo quando recebe null", async () => {
    const response = await request(appAs("gerente"))
      .put("/restaurant-pdv/units/unit-1")
      .send({ blingConnectionId: null });

    expect(response.status).toBe(200);
    expect(updateUnitMock).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ blingConnectionId: null }),
    );
  });

  it("recusa conexão que não está conectada", async () => {
    getConnectionMock.mockResolvedValue({ ...CONNECTED, status: "revoked" });

    const response = await request(appAs("gerente"))
      .put("/restaurant-pdv/units/unit-1")
      .send({ blingConnectionId: "conn-1" });

    expect(response.status).toBe(400);
    expect(updateUnitMock).not.toHaveBeenCalled();
  });
});

describe("GET /restaurant-pdv/units", () => {
  it("devolve a conta vinculada e a contagem de produtos do catálogo", async () => {
    listUnitsWithCatalogMock.mockResolvedValue([
      { id: "unit-1", name: "Matriz", blingConnectionId: "conn-1", blingAccountName: "Bling Matriz", blingProductCount: 214 },
    ]);

    const response = await request(appAs("admin")).get("/restaurant-pdv/units");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      blingAccountName: "Bling Matriz",
      blingProductCount: 214,
    });
  });
});
