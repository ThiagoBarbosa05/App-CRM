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

const { requeueFailedMessagesMock, transitionWhatsappCampaignMock } = vi.hoisted(() => ({
  requeueFailedMessagesMock: vi.fn(),
  transitionWhatsappCampaignMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-campaign.service", () => ({
  requeueFailedMessages: requeueFailedMessagesMock,
}));

vi.mock("../../services/whatsapp-campaign-lifecycle.service", () => ({
  transitionWhatsappCampaign: transitionWhatsappCampaignMock,
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
import { waError } from "../../services/whatsapp-errors";

function makeApp(role: "admin" | "gerente" | "vendedor" = "admin") {
  return createRouteTestApp({
    router: whatsappRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role })],
  });
}

describe("POST /campaigns/:id/retry-failed", () => {
  beforeEach(() => {
    requeueFailedMessagesMock.mockReset();
    transitionWhatsappCampaignMock.mockReset();
  });

  it("200 com { campaignId, requeued } quando a função de serviço reenfileira mensagens", async () => {
    requeueFailedMessagesMock.mockResolvedValue({ requeued: 3 });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campaignId: "camp-1", requeued: 3 });
    expect(requeueFailedMessagesMock).toHaveBeenCalledWith("camp-1", {
      actorId: "u1",
      overrideDedupe: false,
    });
  });

  it("repassa override explícito com usuário e motivo auditável", async () => {
    requeueFailedMessagesMock.mockResolvedValue({ requeued: 1, conflicts: 1 });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send({ overrideDedupe: true, reason: "Cliente autorizou novo envio após corrigirmos o canal" });

    expect(res.status).toBe(200);
    expect(requeueFailedMessagesMock).toHaveBeenCalledWith("camp-1", {
      actorId: "u1",
      overrideDedupe: true,
      reason: "Cliente autorizou novo envio após corrigirmos o canal",
    });
  });

  it("rejeita override sem motivo antes de abrir a transação", async () => {
    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send({ overrideDedupe: true, reason: "curto" });

    expect(res.status).toBe(400);
    expect(requeueFailedMessagesMock).not.toHaveBeenCalled();
  });

  it("permite que gerente controle campanhas", async () => {
    requeueFailedMessagesMock.mockResolvedValue({ requeued: 2 });

    const res = await request(makeApp("gerente"))
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campaignId: "camp-1", requeued: 2 });
  });

  it("bloqueia vendedor antes de consultar ou alterar a campanha", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: "Acesso restrito a administradores e gerentes",
      code: "FORBIDDEN",
    });
    expect(requeueFailedMessagesMock).not.toHaveBeenCalled();
  });

  it("bloqueia vendedor no prefixo antes mesmo da validação do preview", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/whatsapp/campaigns/preview")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
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
    expect(res.body).toMatchObject({
      message: "Campanha cancelada não pode ser reprocessada.",
      code: "CAMPAIGN_REQUEUE_BLOCKED",
    });
  });

  it("409 com mensagem genérica quando o status bloqueado não é cancelled (ex: paused)", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new CampaignRequeueBlockedError("Campanha no estado atual (paused) não pode ser reprocessada.", "paused"),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      message: "Campanha no estado atual (paused) não pode ser reprocessada.",
      code: "CAMPAIGN_REQUEUE_BLOCKED",
    });
  });

  it("409 quando a campanha não é encontrada", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new CampaignRequeueBlockedError("Campanha camp-1 não encontrada.", "not_found"),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      message: "Campanha camp-1 não encontrada.",
      code: "CAMPAIGN_REQUEUE_BLOCKED",
    });
  });

  it("500 genérico para erros inesperados — sem vazar o texto técnico", async () => {
    requeueFailedMessagesMock.mockRejectedValue(
      new Error('duplicate key violates constraint "wa_campaigns_pkey"'),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/retry-failed")
      .send();

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("UNEXPECTED");
    expect(JSON.stringify(res.body)).not.toContain("duplicate key");
  });
});

describe("transições manuais de campanha", () => {
  beforeEach(() => {
    transitionWhatsappCampaignMock.mockReset();
  });

  it.each([
    ["pause", "paused"],
    ["resume", "in_progress"],
  ] as const)("delega %s ao serviço e devolve o estado confirmado", async (action, status) => {
    transitionWhatsappCampaignMock.mockResolvedValue({ campaignId: "camp-1", status });

    const res = await request(makeApp())
      .post(`/api/whatsapp/campaigns/camp-1/${action}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campaignId: "camp-1", status });
    expect(transitionWhatsappCampaignMock).toHaveBeenCalledWith("camp-1", action);
  });

  it("devolve a quantidade de mensagens efetivamente canceladas", async () => {
    transitionWhatsappCampaignMock.mockResolvedValue({
      campaignId: "camp-1",
      status: "cancelled",
      cancelledMessages: 2,
    });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/cancel")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      campaignId: "camp-1",
      status: "cancelled",
      cancelledMessages: 2,
    });
    expect(transitionWhatsappCampaignMock).toHaveBeenCalledWith("camp-1", "cancel");
  });

  it("retorna 404 quando a campanha não existe", async () => {
    transitionWhatsappCampaignMock.mockRejectedValue(waError("CAMPAIGN_NOT_FOUND"));

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/missing/pause")
      .send();

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CAMPAIGN_NOT_FOUND");
  });

  it("retorna 409 quando o estado atual não aceita a ação", async () => {
    transitionWhatsappCampaignMock.mockRejectedValue(
      waError("CAMPAIGN_INVALID_TRANSITION", {
        details: { currentStatus: "completed", action: "cancel" },
      }),
    );

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns/camp-1/cancel")
      .send();

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "CAMPAIGN_INVALID_TRANSITION",
      currentStatus: "completed",
      action: "cancel",
    });
  });
});
