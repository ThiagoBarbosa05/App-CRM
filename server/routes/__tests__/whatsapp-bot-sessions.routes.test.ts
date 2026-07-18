import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação (lança se DATABASE_URL não
// existir); whatsapp.routes.ts e seus imports (campaign-logger,
// integrations/whatsapp → whatsapp-settings.service) puxam esse módulo
// transitivamente, então precisa ser mockado antes de qualquer import.
vi.mock("../../db", () => ({ db: {}, pool: {} }));

// bot-session-history.controller.ts importa normalizePhone de
// whatsapp-conversations.service.ts só por essa função utilitária, mas esse
// service arrasta integrations/evolution → baileys/session-manager, que abre
// uma conexão Postgres real (LISTEN/NOTIFY) no top-level do módulo. Mockar
// aqui evita essa cadeia pesada — só normalizePhone é usado pelo controller.
vi.mock("../../services/whatsapp-conversations.service", () => ({
  normalizePhone: (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const withoutCountry = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    return { digits, withoutCountry };
  },
}));

const { listBotDispatchHistoryMock } = vi.hoisted(() => ({
  listBotDispatchHistoryMock: vi.fn(),
}));

vi.mock("../../controllers/whatsapp/bot-session-history.controller", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../controllers/whatsapp/bot-session-history.controller")
  >();
  return {
    ...actual,
    listBotDispatchHistory: listBotDispatchHistoryMock,
  };
});

import { parseBotSessionHistoryQuery } from "../../controllers/whatsapp/bot-session-history.controller";
import waRouter from "../whatsapp.routes";

describe("parseBotSessionHistoryQuery", () => {
  it("aplica defaults de página quando nada é informado", () => {
    const result = parseBotSessionHistoryQuery({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.botIds).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it("normaliza botIds único em array", () => {
    const result = parseBotSessionHistoryQuery({ botIds: "bot-1" });
    expect(result.botIds).toEqual(["bot-1"]);
  });

  it("mantém botIds já em array", () => {
    const result = parseBotSessionHistoryQuery({ botIds: ["bot-1", "bot-2"] });
    expect(result.botIds).toEqual(["bot-1", "bot-2"]);
  });

  it("rejeita status inválido", () => {
    expect(() => parseBotSessionHistoryQuery({ status: "bogus" })).toThrow();
  });

  it("rejeita dateFrom malformado", () => {
    expect(() => parseBotSessionHistoryQuery({ dateFrom: "not-a-date" })).toThrow();
  });

  it("aceita dateFrom/dateTo ISO válidos", () => {
    const result = parseBotSessionHistoryQuery({
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-17T23:59:59.000Z",
    });
    expect(result.dateFrom).toBe("2026-07-01T00:00:00.000Z");
    expect(result.dateTo).toBe("2026-07-17T23:59:59.000Z");
  });
});

describe("GET /whatsapp/bot-sessions", () => {
  const app = () => createRouteTestApp({ router: waRouter, basePath: "/whatsapp" });

  beforeEach(() => {
    listBotDispatchHistoryMock.mockReset();
  });

  it("200 — repassa os filtros da query para o controller e devolve o resultado", async () => {
    listBotDispatchHistoryMock.mockResolvedValue({ rows: [{ id: "s1" }], total: 1, page: 1, pageSize: 25 });

    const response = await request(app()).get(
      "/whatsapp/bot-sessions?botIds=bot-1&botIds=bot-2&status=failed&page=2&pageSize=10",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ rows: [{ id: "s1" }], total: 1, page: 1, pageSize: 25 });
    expect(listBotDispatchHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        botIds: ["bot-1", "bot-2"],
        status: "failed",
        page: 2,
        pageSize: 10,
      }),
    );
  });

  it("400 — status inválido na query", async () => {
    const response = await request(app()).get("/whatsapp/bot-sessions?status=bogus");

    expect(response.status).toBe(400);
    expect(listBotDispatchHistoryMock).not.toHaveBeenCalled();
  });

  it("500 — erro inesperado do controller vira mensagem genérica", async () => {
    listBotDispatchHistoryMock.mockRejectedValue(new Error("db explodiu"));

    const response = await request(app()).get("/whatsapp/bot-sessions");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Erro ao buscar histórico de bots");
  });
});
