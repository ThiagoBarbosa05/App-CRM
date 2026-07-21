import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const {
  openSessionMock,
  closeSessionMock,
  getCurrentSessionMock,
  getSessionDetailMock,
  addMovementMock,
  listSessionsMock,
} = vi.hoisted(() => ({
  openSessionMock: vi.fn(),
  closeSessionMock: vi.fn(),
  getCurrentSessionMock: vi.fn(),
  getSessionDetailMock: vi.fn(),
  addMovementMock: vi.fn(),
  listSessionsMock: vi.fn(),
}));

vi.mock("../../services/restaurant-cash-session.service", () => ({
  restaurantCashSessionService: {
    openSession: openSessionMock,
    closeSession: closeSessionMock,
    getCurrentSession: getCurrentSessionMock,
    getSessionDetail: getSessionDetailMock,
    addMovement: addMovementMock,
    listSessions: listSessionsMock,
  },
}));

function appAs(role: string, userId = "gestor-1") {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role, userId })],
  });
}

describe("rotas de caixa", () => {
  beforeEach(() => {
    openSessionMock.mockReset().mockResolvedValue({ id: "s1", status: "aberto" });
    closeSessionMock.mockReset().mockResolvedValue({ id: "s1", status: "fechado" });
    getCurrentSessionMock.mockReset().mockResolvedValue(null);
    getSessionDetailMock.mockReset().mockResolvedValue({ id: "s1", status: "aberto" });
    addMovementMock.mockReset().mockResolvedValue({ id: "m1" });
    listSessionsMock.mockReset().mockResolvedValue([]);
  });

  describe("permissões", () => {
    it("garçom pode consultar o caixa atual", async () => {
      const response = await request(appAs("garcom")).get(
        "/restaurant-pdv/cash-sessions/current",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ session: null });
    });

    it("garçom não pode abrir caixa", async () => {
      const response = await request(appAs("garcom"))
        .post("/restaurant-pdv/cash-sessions")
        .send({ openingFloat: "200.00" });

      expect(response.status).toBe(403);
      expect(openSessionMock).not.toHaveBeenCalled();
    });

    it("garçom não pode registrar sangria", async () => {
      const response = await request(appAs("garcom"))
        .post("/restaurant-pdv/cash-sessions/movements")
        .send({ type: "sangria", amount: "100.00", reason: "Depósito bancário" });

      expect(response.status).toBe(403);
      expect(addMovementMock).not.toHaveBeenCalled();
    });

    it("gerente pode abrir caixa", async () => {
      const response = await request(appAs("gerente", "ger-9"))
        .post("/restaurant-pdv/cash-sessions")
        .send({ openingFloat: "200.00" });

      expect(response.status).toBe(201);
      expect(openSessionMock).toHaveBeenCalledWith("200.00", "ger-9");
    });
  });

  describe("abertura", () => {
    it("propaga caixa já aberto como 409", async () => {
      openSessionMock.mockRejectedValue(
        Object.assign(new Error("Já existe um caixa aberto"), {
          code: "SESSION_ALREADY_OPEN",
        }),
      );

      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions")
        .send({ openingFloat: "200.00" });

      expect(response.status).toBe(409);
    });

    it("exige fundo de troco", async () => {
      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions")
        .send({});

      expect(response.status).toBe(400);
      expect(openSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("movimentos", () => {
    it("exige motivo com ao menos 3 caracteres", async () => {
      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions/movements")
        .send({ type: "sangria", amount: "50.00", reason: "x" });

      expect(response.status).toBe(400);
      expect(addMovementMock).not.toHaveBeenCalled();
    });

    it("rejeita tipo de movimento desconhecido", async () => {
      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions/movements")
        .send({ type: "transferencia", amount: "50.00", reason: "Motivo válido" });

      expect(response.status).toBe(400);
    });

    it("propaga sangria maior que o caixa como 400", async () => {
      addMovementMock.mockRejectedValue(
        Object.assign(new Error("A sangria é maior que o dinheiro em caixa"), {
          code: "INSUFFICIENT_CASH",
        }),
      );

      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions/movements")
        .send({ type: "sangria", amount: "9999.00", reason: "Depósito bancário" });

      expect(response.status).toBe(400);
    });

    it("registra suprimento válido", async () => {
      const response = await request(appAs("admin", "adm-2"))
        .post("/restaurant-pdv/cash-sessions/movements")
        .send({ type: "suprimento", amount: "100.00", reason: "Reforço de troco" });

      expect(response.status).toBe(201);
      expect(addMovementMock).toHaveBeenCalledWith(
        { type: "suprimento", amount: "100.00", reason: "Reforço de troco" },
        "adm-2",
      );
    });
  });

  describe("fechamento", () => {
    it("bloqueia fechamento com comandas abertas (409)", async () => {
      closeSessionMock.mockRejectedValue(
        Object.assign(new Error("Existem 2 comanda(s) aberta(s) (mesa 4, 7)"), {
          code: "OPEN_ORDERS",
        }),
      );

      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions/s1/close")
        .send({ countedCash: "300.00" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("comanda(s) aberta(s)");
    });

    it("exige o valor contado", async () => {
      const response = await request(appAs("admin"))
        .post("/restaurant-pdv/cash-sessions/s1/close")
        .send({});

      expect(response.status).toBe(400);
      expect(closeSessionMock).not.toHaveBeenCalled();
    });

    it("fecha com valor contado e observação", async () => {
      const response = await request(appAs("admin", "adm-3"))
        .post("/restaurant-pdv/cash-sessions/s1/close")
        .send({ countedCash: "298.00", notes: "Faltaram 2 reais" });

      expect(response.status).toBe(200);
      expect(closeSessionMock).toHaveBeenCalledWith(
        "s1",
        { countedCash: "298.00", notes: "Faltaram 2 reais" },
        "adm-3",
      );
    });
  });

  it("GET /cash-sessions/current não é capturada pela rota /:id", async () => {
    getCurrentSessionMock.mockResolvedValue({ id: "s1" });

    await request(appAs("admin")).get("/restaurant-pdv/cash-sessions/current");

    expect(getCurrentSessionMock).toHaveBeenCalled();
    expect(getSessionDetailMock).toHaveBeenCalledWith("s1");
  });
});
