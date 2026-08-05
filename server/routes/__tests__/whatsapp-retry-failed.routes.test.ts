import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação; whatsapp.routes.ts o puxa
// transitivamente por vários services/controllers importados no topo do
// arquivo. Mockamos db e todos os módulos transitivos para isolar só o
// endpoint POST /campaigns/:id/retry-failed, que aqui delega inteiramente
// para requeueFailedMessages (mockado abaixo) — a lógica de transação em si
// é testada separadamente em whatsapp-campaign.unit.test.ts.
vi.mock("../../db", () => ({ db: {}, pool: {} }));

const { requeueFailedMessagesMock } = vi.hoisted(() => ({
  requeueFailedMessagesMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-campaign.service", () => ({
  requeueFailedMessages: requeueFailedMessagesMock,
}));

vi.mock("../../controllers/campaigns/campaign-logger", () => ({
  listCampaigns: vi.fn(),
  getCampaignDetails: vi.fn(),
  getCampaignStats: vi.fn(),
  getCampaignBotStats: vi.fn(),
}));

vi.mock("../../controllers/whatsapp/bot-session-history.controller", () => ({
  listBotDispatchHistory: vi.fn(),
  parseBotSessionHistoryQuery: vi.fn(),
}));

vi.mock("../../services/whatsapp-campaign-dedupe.service", () => ({
  buildCampaignContentSnapshot: vi.fn(),
  applyCampaignTag: vi.fn(),
  DEFAULT_DEDUPE_WINDOW_HOURS: 24,
  fingerprintForClient: vi.fn(),
  findConflict: vi.fn(),
  MAX_DEDUPE_WINDOW_HOURS: 24 * 365,
  reserveCampaignMessage: vi.fn(),
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  listChannelIdsForUser: vi.fn(),
  resolveChannelById: vi.fn(),
}));

vi.mock("../../services/whatsapp-campaign-audience.service", () => ({
  resolveCampaignAudience: vi.fn(),
}));

vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: vi.fn(),
  BotCompatibilityLookupError: class BotCompatibilityLookupError extends Error {
    statusCode = 502;
  },
}));

vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
}));

import whatsappRouter from "../whatsapp.routes";
import { CampaignRequeueBlockedError } from "../../services/whatsapp-campaign-errors";

function makeApp() {
  return createRouteTestApp({
    router: whatsappRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role: "admin" })],
  });
}

describe("POST /campaigns/:id/retry-failed", () => {
  beforeEach(() => {
    requeueFailedMessagesMock.mockReset();
  });

  it("200 com { campaignId, requeued } quando a função de serviço reenfileira mensagens", async () => {
    requeueFailedMessagesMock.mockResolvedValue({ requeued: 3 });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campaignId: "camp-1", requeued: 3 });
    expect(requeueFailedMessagesMock).toHaveBeenCalledWith("camp-1");
  });

  it("{ requeued: 0 } quando não há mensagens failed", async () => {
    requeueFailedMessagesMock.mockResolvedValue({ requeued: 0 });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campaignId: "camp-1", requeued: 0 });
  });

  it("409 quando a função de serviço sinaliza bloqueio por status (ex: cancelled)", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new CampaignRequeueBlockedError("Campanha cancelada não pode ser reprocessada.", "cancelled"),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Campanha cancelada não pode ser reprocessada." });
  });

  it("409 com mensagem genérica quando o status bloqueado não é cancelled (ex: paused)", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new CampaignRequeueBlockedError("Campanha no estado atual (paused) não pode ser reprocessada.", "paused"),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Campanha no estado atual (paused) não pode ser reprocessada." });
  });

  it("409 quando a campanha não é encontrada", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new CampaignRequeueBlockedError("Campanha camp-1 não encontrada.", "not_found"),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Campanha camp-1 não encontrada." });
  });

  it("500 para erros inesperados que não são CampaignRequeueBlockedError", async () => {
    requeueFailedMessagesMock.mockRejectedValue(new Error("boom"));

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "boom" });
  });
});
