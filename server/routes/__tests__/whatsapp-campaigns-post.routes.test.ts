import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";

const {
  channelRows,
  resolveChannelByIdMock,
  analyzeBotCompatibilityMock,
  createAtomicWhatsappCampaignMock,
} = vi.hoisted(() => ({
  channelRows: [] as unknown[],
  resolveChannelByIdMock: vi.fn(),
  analyzeBotCompatibilityMock: vi.fn(),
  createAtomicWhatsappCampaignMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(channelRows),
          then: (resolve: (value: unknown) => unknown) => resolve(channelRows),
        }),
      }),
    })),
  },
}));
vi.mock("../../controllers/campaigns/campaign-logger", () => ({
  listCampaigns: vi.fn(), getCampaignDetails: vi.fn(), getCampaignStats: vi.fn(), getCampaignBotStats: vi.fn(),
}));
vi.mock("../../controllers/whatsapp/bot-session-history.controller", () => ({
  listBotDispatchHistory: vi.fn(), parseBotSessionHistoryQuery: vi.fn(),
}));
vi.mock("../../services/whatsapp-campaign-dedupe.service", () => ({
  buildCampaignContentSnapshot: vi.fn(), applyCampaignTag: vi.fn(),
  DEFAULT_DEDUPE_WINDOW_HOURS: 24, fingerprintForClient: vi.fn(), findConflict: vi.fn(),
  MAX_DEDUPE_WINDOW_HOURS: 24 * 365, reserveCampaignMessage: vi.fn(),
}));
vi.mock("../../services/whatsapp-channels.service", () => ({
  listChannelIdsForUser: vi.fn(), resolveChannelById: resolveChannelByIdMock,
}));
vi.mock("../../services/whatsapp-campaign-audience.service", () => ({ resolveCampaignAudience: vi.fn() }));
vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: analyzeBotCompatibilityMock,
  BotCompatibilityLookupError: class BotCompatibilityLookupError extends Error { statusCode = 502; },
}));
vi.mock("../../services/whatsapp-campaign.service", () => ({ requeueFailedMessages: vi.fn() }));
vi.mock("../../services/whatsapp-campaign-creation.service", () => ({
  createAtomicWhatsappCampaign: createAtomicWhatsappCampaignMock,
}));
vi.mock("../../integrations/whatsapp", () => ({ sendTextMessage: vi.fn(), sendTemplateMessage: vi.fn() }));

import whatsappRouter from "../whatsapp.routes";
import { waError } from "../../services/whatsapp-errors";

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";
const payload = {
  name: "Campanha atômica",
  description: "Teste",
  waTemplateId: "tpl-1",
  waChannelId: 1,
  audience: { mode: "explicit", clientIds: [CLIENT_ID] },
  dedupeWindowHours: 24,
};

function makeApp() {
  return createRouteTestApp({
    router: whatsappRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role: "admin" })],
  });
}

describe("POST /campaigns — criação atômica", () => {
  beforeEach(() => {
    channelRows.length = 0;
    channelRows.push({ id: 1, provider: "cloud_api", connectionStatus: "connected" });
    resolveChannelByIdMock.mockReset().mockResolvedValue({ provider: "cloud_api" });
    analyzeBotCompatibilityMock.mockReset().mockResolvedValue({ compatible: true, issues: [] });
    createAtomicWhatsappCampaignMock.mockReset().mockResolvedValue({
      campaignId: CAMPAIGN_ID, status: "in_progress", queued: 1, selected: 1, eligible: 1,
      suppressedDuplicate: 0, skippedNoPhone: 0, skippedDuplicatePhone: 0,
      skippedOptedOut: 0, skippedAlreadyQueued: 0, conflicts: [], scheduledAt: null,
    });
  });

  it("aceita a definição completa e delega uma única criação ao serviço", async () => {
    const response = await request(makeApp()).post("/api/whatsapp/campaigns").send(payload);

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ campaignId: CAMPAIGN_ID, queued: 1 });
    expect(createAtomicWhatsappCampaignMock).toHaveBeenCalledWith(
      expect.objectContaining({ ...payload, createdBy: "u1" }),
    );
  });

  it("rejeita canal desconectado antes de iniciar a transação de criação", async () => {
    resolveChannelByIdMock.mockResolvedValue(null);

    const response = await request(makeApp()).post("/api/whatsapp/campaigns").send(payload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("CHANNEL_DISCONNECTED");
    expect(createAtomicWhatsappCampaignMock).not.toHaveBeenCalled();
  });

  it("propaga CAMPAIGN_ALL_DUPLICATE com o resumo devolvido pelo serviço", async () => {
    createAtomicWhatsappCampaignMock.mockRejectedValue(
      waError("CAMPAIGN_ALL_DUPLICATE", {
        details: { campaignId: CAMPAIGN_ID, queued: 0, suppressedDuplicate: 1 },
      }),
    );

    const response = await request(makeApp()).post("/api/whatsapp/campaigns").send(payload);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: "CAMPAIGN_ALL_DUPLICATE", campaignId: CAMPAIGN_ID, queued: 0, suppressedDuplicate: 1,
    });
  });

  it("rejeita payload sem template nem bot antes de consultar o canal", async () => {
    const { waTemplateId: _removed, ...withoutContent } = payload;

    const response = await request(makeApp()).post("/api/whatsapp/campaigns").send(withoutContent);

    expect(response.status).toBe(400);
    expect(createAtomicWhatsappCampaignMock).not.toHaveBeenCalled();
  });
});
