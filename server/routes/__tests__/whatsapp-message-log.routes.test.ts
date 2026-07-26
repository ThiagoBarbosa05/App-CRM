import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação (lança se DATABASE_URL não
// existir); message-log.controller.ts importa esse módulo, então precisa ser
// mockado antes de qualquer import.
vi.mock("../../db", () => ({ db: {}, pool: {} }));

const { listWhatsappMessageLogMock } = vi.hoisted(() => ({
  listWhatsappMessageLogMock: vi.fn(),
}));

vi.mock("../../controllers/whatsapp/message-log.controller", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../controllers/whatsapp/message-log.controller")
  >();
  return {
    ...actual,
    listWhatsappMessageLog: listWhatsappMessageLogMock,
  };
});

import { parseMessageLogQuery } from "../../controllers/whatsapp/message-log.controller";
import messageLogRouter from "../whatsapp-message-log.routes";

describe("parseMessageLogQuery", () => {
  it("aplica defaults de página quando nada é informado", () => {
    const result = parseMessageLogQuery({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.direction).toBeUndefined();
    expect(result.status).toBeUndefined();
    expect(result.channelIds).toBeUndefined();
  });

  it("normaliza channelIds único em array numérico", () => {
    const result = parseMessageLogQuery({ channelIds: "3" });
    expect(result.channelIds).toEqual([3]);
  });

  it("mantém channelIds já em array, convertendo para número", () => {
    const result = parseMessageLogQuery({ channelIds: ["1", "2"] });
    expect(result.channelIds).toEqual([1, 2]);
  });

  it("rejeita direction inválida", () => {
    expect(() => parseMessageLogQuery({ direction: "bogus" })).toThrow();
  });

  it("rejeita status inválido", () => {
    expect(() => parseMessageLogQuery({ status: "bogus" })).toThrow();
  });

  it("rejeita origin inválida", () => {
    expect(() => parseMessageLogQuery({ origin: "bogus" })).toThrow();
  });

  it("rejeita dateFrom malformado", () => {
    expect(() => parseMessageLogQuery({ dateFrom: "not-a-date" })).toThrow();
  });

  it("aceita dateFrom/dateTo ISO válidos", () => {
    const result = parseMessageLogQuery({
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-17T23:59:59.000Z",
    });
    expect(result.dateFrom).toBe("2026-07-01T00:00:00.000Z");
    expect(result.dateTo).toBe("2026-07-17T23:59:59.000Z");
  });
});

describe("GET /whatsapp/message-log", () => {
  const app = () => createRouteTestApp({ router: messageLogRouter, basePath: "/whatsapp" });

  beforeEach(() => {
    listWhatsappMessageLogMock.mockReset();
  });

  it("200 — repassa os filtros da query para o controller e devolve o resultado", async () => {
    listWhatsappMessageLogMock.mockResolvedValue({ rows: [{ id: "m1" }], total: 1, page: 1, pageSize: 25 });

    const response = await request(app()).get(
      "/whatsapp/message-log?direction=outbound&status=failed&origin=manual&channelIds=1&channelIds=2&page=2&pageSize=10",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ rows: [{ id: "m1" }], total: 1, page: 1, pageSize: 25 });
    expect(listWhatsappMessageLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "outbound",
        status: "failed",
        origin: "manual",
        channelIds: [1, 2],
        page: 2,
        pageSize: 10,
      }),
    );
  });

  it("400 — status inválido na query", async () => {
    const response = await request(app()).get("/whatsapp/message-log?status=bogus");

    expect(response.status).toBe(400);
    expect(listWhatsappMessageLogMock).not.toHaveBeenCalled();
  });

  it("500 — erro inesperado do controller vira mensagem genérica", async () => {
    listWhatsappMessageLogMock.mockRejectedValue(new Error("db explodiu"));

    const response = await request(app()).get("/whatsapp/message-log");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Erro ao buscar log de mensagens");
  });
});
