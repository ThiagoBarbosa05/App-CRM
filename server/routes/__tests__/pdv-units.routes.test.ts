import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const {
  createUnitMock,
  updateUnitMock,
  listUnitsWithCatalogMock,
  getConnectionMock,
  getUnitMock,
  listEligibleSellersMock,
  searchBlingContactsMock,
} = vi.hoisted(() => ({
  createUnitMock: vi.fn(),
  updateUnitMock: vi.fn(),
  listUnitsWithCatalogMock: vi.fn(),
  getConnectionMock: vi.fn(),
  getUnitMock: vi.fn(),
  listEligibleSellersMock: vi.fn(),
  searchBlingContactsMock: vi.fn(),
}));

vi.mock("../../services/pdv-units.service", () => ({
  pdvUnitsService: {
    createUnit: createUnitMock,
    updateUnit: updateUnitMock,
    listUnitsWithCatalog: listUnitsWithCatalogMock,
    listUnits: vi.fn(),
    getUnit: getUnitMock,
    deactivateUnit: vi.fn(),
    listEligibleSellers: listEligibleSellersMock,
    searchBlingContacts: searchBlingContactsMock,
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
const ELIGIBLE_SELLER = { id: "user-1", name: "Vendedor 1", email: "v1@example.com", blingVendedorId: "999", blingVendedorName: "Vendedor 1" };

beforeEach(() => {
  createUnitMock.mockReset().mockResolvedValue({ id: "unit-1" });
  updateUnitMock.mockReset().mockResolvedValue({ id: "unit-1" });
  listUnitsWithCatalogMock.mockReset().mockResolvedValue([]);
  getConnectionMock.mockReset().mockResolvedValue(CONNECTED);
  getUnitMock.mockReset().mockResolvedValue({ id: "unit-1", blingConnectionId: "conn-1" });
  listEligibleSellersMock.mockReset().mockResolvedValue([ELIGIBLE_SELLER]);
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

  it("persiste o defaultSellerId quando o vendedor está mapeado para a conexão", async () => {
    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: "conn-1", defaultSellerId: "user-1" });

    expect(response.status).toBe(201);
    expect(listEligibleSellersMock).toHaveBeenCalledWith("conn-1");
    expect(createUnitMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultSellerId: "user-1" }),
    );
  });

  it("recusa defaultSellerId sem conexão Bling selecionada", async () => {
    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", defaultSellerId: "user-1" });

    expect(response.status).toBe(400);
    expect(createUnitMock).not.toHaveBeenCalled();
  });

  it("recusa defaultSellerId que não está mapeado para a conexão", async () => {
    listEligibleSellersMock.mockResolvedValue([]);

    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", blingConnectionId: "conn-1", defaultSellerId: "user-fantasma" });

    expect(response.status).toBe(400);
    expect(createUnitMock).not.toHaveBeenCalled();
  });

  /**
   * O Consumidor Final é o que destrava o pedido de venda: sem ele toda comanda
   * fechada é bloqueada. O contato vem da busca na própria conta Bling, então o
   * que se guarda é o id de lá — não um cliente do CRM.
   */
  it("persiste o contato Bling escolhido como Consumidor Final", async () => {
    const response = await request(appAs("admin")).post("/restaurant-pdv/units").send({
      name: "Matriz",
      blingConnectionId: "conn-1",
      defaultBlingContactId: "77123",
      defaultBlingContactName: "Consumidor Final",
    });

    expect(response.status).toBe(201);
    expect(createUnitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultBlingContactId: "77123",
        defaultBlingContactName: "Consumidor Final",
      }),
    );
  });

  it("recusa Consumidor Final sem conexão Bling selecionada", async () => {
    const response = await request(appAs("admin"))
      .post("/restaurant-pdv/units")
      .send({ name: "Matriz", defaultBlingContactId: "77123" });

    expect(response.status).toBe(400);
    expect(createUnitMock).not.toHaveBeenCalled();
  });
});

describe("GET /restaurant-pdv/units/bling-contacts", () => {
  beforeEach(() => {
    searchBlingContactsMock.mockReset().mockResolvedValue([
      { id: "77123", nome: "Consumidor Final", numeroDocumento: null },
    ]);
  });

  it("repassa a pesquisa para a busca na conta Bling", async () => {
    const response = await request(appAs("admin")).get(
      "/restaurant-pdv/units/bling-contacts?connectionId=conn-1&pesquisa=consumidor",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(searchBlingContactsMock).toHaveBeenCalledWith("conn-1", "consumidor", 20);
  });

  it("não chama a API do Bling sem termo de pesquisa", async () => {
    const response = await request(appAs("admin")).get(
      "/restaurant-pdv/units/bling-contacts?connectionId=conn-1",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(searchBlingContactsMock).not.toHaveBeenCalled();
  });

  it("falha do Bling vira 502, não 500 genérico", async () => {
    searchBlingContactsMock.mockRejectedValue(new Error("timeout"));

    const response = await request(appAs("admin")).get(
      "/restaurant-pdv/units/bling-contacts?connectionId=conn-1&pesquisa=abc",
    );

    expect(response.status).toBe(502);
  });

  it("garçom não pode buscar contatos", async () => {
    const response = await request(appAs("garcom")).get(
      "/restaurant-pdv/units/bling-contacts?connectionId=conn-1&pesquisa=abc",
    );

    expect(response.status).toBe(403);
    expect(searchBlingContactsMock).not.toHaveBeenCalled();
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

  it("persiste o defaultSellerId ao editar junto com a conexão", async () => {
    const response = await request(appAs("gerente"))
      .put("/restaurant-pdv/units/unit-1")
      .send({ blingConnectionId: "conn-1", defaultSellerId: "user-1" });

    expect(response.status).toBe(200);
    expect(listEligibleSellersMock).toHaveBeenCalledWith("conn-1");
    expect(updateUnitMock).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ defaultSellerId: "user-1" }),
    );
  });

  it("valida o defaultSellerId contra a conexão já salva quando o PUT não envia blingConnectionId", async () => {
    const response = await request(appAs("gerente"))
      .put("/restaurant-pdv/units/unit-1")
      .send({ defaultSellerId: "user-1" });

    expect(response.status).toBe(200);
    expect(getUnitMock).toHaveBeenCalledWith("unit-1");
    expect(listEligibleSellersMock).toHaveBeenCalledWith("conn-1");
    expect(updateUnitMock).toHaveBeenCalledWith(
      "unit-1",
      expect.objectContaining({ defaultSellerId: "user-1" }),
    );
  });
});

describe("GET /restaurant-pdv/units/eligible-sellers", () => {
  it("devolve os vendedores mapeados para a conexão informada", async () => {
    const response = await request(appAs("admin"))
      .get("/restaurant-pdv/units/eligible-sellers")
      .query({ connectionId: "conn-1" });

    expect(response.status).toBe(200);
    expect(listEligibleSellersMock).toHaveBeenCalledWith("conn-1");
    expect(response.body).toEqual([ELIGIBLE_SELLER]);
  });

  it("devolve array vazio sem connectionId, sem consultar o serviço", async () => {
    const response = await request(appAs("admin")).get("/restaurant-pdv/units/eligible-sellers");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(listEligibleSellersMock).not.toHaveBeenCalled();
  });

  it("nega acesso ao garçom", async () => {
    const response = await request(appAs("garcom"))
      .get("/restaurant-pdv/units/eligible-sellers")
      .query({ connectionId: "conn-1" });

    expect(response.status).toBe(403);
    expect(listEligibleSellersMock).not.toHaveBeenCalled();
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
