import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { getSalesReportMock, getDailySummaryMock, getCancellationsReportMock } = vi.hoisted(
  () => ({
    getSalesReportMock: vi.fn(),
    getDailySummaryMock: vi.fn(),
    getCancellationsReportMock: vi.fn(),
  }),
);

vi.mock("../../services/restaurant-reports.service", () => ({
  restaurantReportsService: {
    getSalesReport: getSalesReportMock,
    getDailySummary: getDailySummaryMock,
    getCancellationsReport: getCancellationsReportMock,
  },
}));

/**
 * `pdvUnitId` default injetado ("test-unit-id") faz o `resolvePdvUnit` real
 * curto-circuitar — ele está montado antes das rotas, então sem isso o teste
 * de 403 receberia 400 e o teste tocaria o banco.
 */
function appAs(role: string, pdvUnitId?: string | null) {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role, userId: "gestor-1", pdvUnitId })],
  });
}

const ROUTES = [
  ["/restaurant-pdv/reports/sales", () => getSalesReportMock],
  ["/restaurant-pdv/reports/daily-summary", () => getDailySummaryMock],
  ["/restaurant-pdv/reports/cancellations", () => getCancellationsReportMock],
] as const;

describe("rotas de relatório do PDV", () => {
  beforeEach(() => {
    getSalesReportMock.mockReset().mockResolvedValue({ totalRevenue: 0, orderCount: 0 });
    getDailySummaryMock.mockReset().mockResolvedValue({ date: "2026-08-02", totalRevenue: 0 });
    getCancellationsReportMock
      .mockReset()
      .mockResolvedValue({ itemCount: 0, total: "0.00", items: [], truncated: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * O bug central: nenhuma das três consultas filtrava por unidade, então o
   * relatório somava o faturamento de todas as unidades e o seletor de
   * unidade não mudava nenhum número.
   */
  describe("filtro de unidade", () => {
    it.each(ROUTES)("%s repassa a unidade da requisição", async (path, getMock) => {
      const response = await request(appAs("gerente")).get(path);

      expect(response.status).toBe(200);
      expect(getMock()).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: "test-unit-id" }),
      );
    });

    it.each(ROUTES)("%s devolve 400 sem unidade resolvida", async (path, getMock) => {
      const response = await request(appAs("gerente", null)).get(path);

      expect(response.status).toBe(400);
      expect(getMock()).not.toHaveBeenCalled();
    });
  });

  describe("permissões", () => {
    it.each(ROUTES)("%s é restrita ao gestor — garçom leva 403", async (path, getMock) => {
      const response = await request(appAs("garcom")).get(path);

      expect(response.status).toBe(403);
      expect(getMock()).not.toHaveBeenCalled();
    });

    it.each(ROUTES)("%s — vendedor leva 403", async (path, getMock) => {
      const response = await request(appAs("vendedor")).get(path);

      expect(response.status).toBe(403);
      expect(getMock()).not.toHaveBeenCalled();
    });

    it.each(ROUTES)("%s — admin tem acesso", async (path) => {
      const response = await request(appAs("admin")).get(path);

      expect(response.status).toBe(200);
    });
  });

  describe("validação de período", () => {
    it("recusa data malformada em vez de estourar 500", async () => {
      const response = await request(appAs("gerente")).get(
        "/restaurant-pdv/reports/sales?from=abacaxi&to=2026-08-02",
      );

      expect(response.status).toBe(400);
      expect(getSalesReportMock).not.toHaveBeenCalled();
    });

    it("recusa data inexistente no calendário", async () => {
      const response = await request(appAs("gerente")).get(
        "/restaurant-pdv/reports/daily-summary?date=2026-13-45",
      );

      expect(response.status).toBe(400);
      expect(getDailySummaryMock).not.toHaveBeenCalled();
    });

    it("recusa período invertido", async () => {
      const response = await request(appAs("gerente")).get(
        "/restaurant-pdv/reports/sales?from=2026-08-10&to=2026-08-01",
      );

      expect(response.status).toBe(400);
      expect(getSalesReportMock).not.toHaveBeenCalled();
    });

    it("recusa janela maior que o teto — é ela que segura a agregação sem limit", async () => {
      const response = await request(appAs("gerente")).get(
        "/restaurant-pdv/reports/cancellations?from=2024-01-01&to=2026-08-02",
      );

      expect(response.status).toBe(400);
      expect(getCancellationsReportMock).not.toHaveBeenCalled();
    });

    it("aceita período válido e converte para a janela de São Paulo", async () => {
      const response = await request(appAs("gerente")).get(
        "/restaurant-pdv/reports/sales?from=2026-08-01&to=2026-08-02",
      );

      expect(response.status).toBe(200);
      const { from, to } = getSalesReportMock.mock.calls[0][0];
      expect(from.toISOString()).toBe("2026-08-01T03:00:00.000Z");
      // Fim do dia, não meia-noite: senão o dia inteiro de vendas some.
      expect(to.toISOString()).toBe("2026-08-03T02:59:59.999Z");
    });
  });

  it("repassa o shape ampliado do relatório de vendas sem filtrar campos", async () => {
    const report = {
      totalRevenue: 100,
      orderCount: 2,
      averageTicket: 50,
      serviceFeeTotal: 10,
      discounts: { total: 5, orderCount: 1, byReason: [] },
      averageTicketPerPerson: 25,
      averageStayMinutes: 42,
      byTable: [{ tableNumber: 3, orderCount: 2, revenue: 100 }],
      byWeekday: [{ weekday: 6, orderCount: 2, revenue: 100 }],
      ticketDistribution: [{ bucket: "0-50", orderCount: 2 }],
      comparison: {
        totalRevenue: 80,
        orderCount: 2,
        averageTicket: 40,
        revenueChangePct: 25,
        orderCountChangePct: 0,
        averageTicketChangePct: 25,
      },
    };
    getSalesReportMock.mockResolvedValue(report);

    const response = await request(appAs("gerente")).get("/restaurant-pdv/reports/sales");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(report);
  });

  /**
   * Regressão do bug de fuso: às 21h de São Paulo o UTC já virou o dia
   * seguinte. O default precisa ser o dia de SP, senão a tela abre em
   * "amanhã" e mostra zero no horário de pico.
   */
  describe("default de data no fuso de São Paulo", () => {
    it("21h em SP ainda usa o dia corrente no resumo diário", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-03T00:11:48.950Z"));

      await request(appAs("gerente")).get("/restaurant-pdv/reports/daily-summary");

      expect(getDailySummaryMock).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-08-02" }),
      );
    });

    it("21h em SP mantém a janela de 7 dias terminando hoje", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-03T00:11:48.950Z"));

      await request(appAs("gerente")).get("/restaurant-pdv/reports/sales");

      const { from, to } = getSalesReportMock.mock.calls[0][0];
      expect(from.toISOString()).toBe("2026-07-27T03:00:00.000Z");
      expect(to.toISOString()).toBe("2026-08-03T02:59:59.999Z");
    });
  });
});
