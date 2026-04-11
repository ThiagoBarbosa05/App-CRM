import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { reportsRouter } from "../reports.routes";

const {
  getGeneralReportsControllerMock,
  getClientReportsControllerMock,
  getCompanyReportsControllerMock,
  dbSelectMock,
  dbLeftJoinMock,
  dbGroupByMock,
} = vi.hoisted(() => ({
  getGeneralReportsControllerMock: vi.fn(),
  getClientReportsControllerMock: vi.fn(),
  getCompanyReportsControllerMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbLeftJoinMock: vi.fn(),
  dbGroupByMock: vi.fn(),
}));

vi.mock("../../controllers/reports", () => ({
  getGeneralReportsController: getGeneralReportsControllerMock,
  getClientReportsController: getClientReportsControllerMock,
  getCompanyReportsController: getCompanyReportsControllerMock,
}));

vi.mock("../../db", () => ({
  db: {
    select: dbSelectMock,
  },
}));

describe("reportsRouter", () => {
  beforeEach(() => {
    getGeneralReportsControllerMock.mockReset();
    getClientReportsControllerMock.mockReset();
    getCompanyReportsControllerMock.mockReset();
    dbSelectMock.mockReset();
    dbLeftJoinMock.mockReset();
    dbGroupByMock.mockReset();

    getGeneralReportsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "general" });
    });
    getClientReportsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "clients" });
    });
    getCompanyReportsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "companies" });
    });

    dbGroupByMock.mockResolvedValue([{ id: "sale-1", items: [] }]);
    dbLeftJoinMock.mockReturnValue({ groupBy: dbGroupByMock });
    dbSelectMock.mockReturnValue({
      from: vi.fn(() => ({ leftJoin: dbLeftJoinMock })),
    });
  });

  it("delegates GET /general to the existing controller", async () => {
    const app = createRouteTestApp({ router: reportsRouter, basePath: "/reports" });

    const response = await request(app).get("/reports/general");

    expect(getGeneralReportsControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: "general" });
  });

  it("delegates GET /clients to the existing controller", async () => {
    const app = createRouteTestApp({ router: reportsRouter, basePath: "/reports" });

    const response = await request(app).get("/reports/clients");

    expect(getClientReportsControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: "clients" });
  });

  it("delegates GET /companies to the existing controller", async () => {
    const app = createRouteTestApp({ router: reportsRouter, basePath: "/reports" });

    const response = await request(app).get("/reports/companies");

    expect(getCompanyReportsControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ route: "companies" });
  });

  it("keeps GET /sales payload behavior", async () => {
    const app = createRouteTestApp({ router: reportsRouter, basePath: "/reports" });

    const response = await request(app).get("/reports/sales?startDate=2024-01-01&endDate=2024-01-31");

    expect(dbSelectMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "sale-1", items: [] }]);
  });

  it("returns 500 for GET /sales when query fails", async () => {
    dbGroupByMock.mockRejectedValueOnce(new Error("db failed"));
    const app = createRouteTestApp({ router: reportsRouter, basePath: "/reports" });

    const response = await request(app).get("/reports/sales");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Erro ao gerar relatório de vendas" });
  });
});
