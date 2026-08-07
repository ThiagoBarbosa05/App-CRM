import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

/**
 * O cadastro rápido do PDV inseria sem nenhum lookup prévio, contando só com o
 * `clients_phone_unique` — que é UNIQUE sobre o texto cru. Um cliente legado
 * gravado como "31999910141" não colide com o "+5531999910141" que o PDV grava,
 * então cada atendimento criava mais uma cópia do mesmo cliente.
 */

const { selectLimitMock, insertReturningMock } = vi.hoisted(() => ({
  selectLimitMock: vi.fn(),
  insertReturningMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: selectLimitMock })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertReturningMock })),
    })),
  },
}));

const app = createRouteTestApp({
  router: restaurantPdvRouter,
  basePath: "/restaurant-pdv",
  middlewares: [createMockAuthMiddleware({ role: "gerente" })],
});

const CLIENTE_LEGADO = {
  id: "client-legado",
  name: "Newton Souza",
  phone: "31999910141", // formato antigo, sem o +55
  cpf: null,
  email: null,
};

describe("POST /restaurant-pdv/clients", () => {
  beforeEach(() => {
    selectLimitMock.mockReset().mockResolvedValue([]);
    insertReturningMock.mockReset().mockResolvedValue([
      { id: "client-novo", name: "Newton Souza", phone: "+5531999910141", cpf: null, email: null },
    ]);
  });

  it("reaproveita o cliente legado em vez de criar uma cópia", async () => {
    selectLimitMock.mockResolvedValue([CLIENTE_LEGADO]);

    const response = await request(app)
      .post("/restaurant-pdv/clients")
      .send({ name: "Newton Souza", phone: "(31) 99991-0141" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "client-legado", existing: true });
    expect(insertReturningMock).not.toHaveBeenCalled();
  });

  it("cria quando não há nenhum cliente correspondente", async () => {
    const response = await request(app)
      .post("/restaurant-pdv/clients")
      .send({ name: "Newton Souza", phone: "(31) 99991-0141" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "client-novo", existing: false });
    expect(insertReturningMock).toHaveBeenCalled();
  });

  it("insere sem consultar quando não há telefone, CPF nem e-mail", async () => {
    // Sem chave de identidade não há o que procurar — buscar às cegas devolveria
    // um cliente qualquer.
    await request(app).post("/restaurant-pdv/clients").send({ name: "Consumidor Final" });

    expect(selectLimitMock).not.toHaveBeenCalled();
    expect(insertReturningMock).toHaveBeenCalled();
  });

  it("rejeita nome ausente antes de tocar no banco", async () => {
    const response = await request(app).post("/restaurant-pdv/clients").send({ name: "N" });

    expect(response.status).toBe(400);
    expect(selectLimitMock).not.toHaveBeenCalled();
    expect(insertReturningMock).not.toHaveBeenCalled();
  });
});
