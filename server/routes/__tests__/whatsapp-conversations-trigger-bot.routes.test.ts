import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAuthMiddleware, createRouteTestApp } from "../../test/create-route-test-app";

vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../lib/sse-hub", () => ({
  addSseClient: () => () => {},
  addConversationSseClient: () => () => {},
  publishConversationEvent: () => {},
  publishSseEvent: () => {},
  revokeStaleConversationAccess: async () => {},
}));

const mocks = vi.hoisted(() => ({
  resolveConversationId: vi.fn(),
  isConversationAccessibleToUser: vi.fn(),
  resolveOutboundChannelForSender: vi.fn(),
  startBotSession: vi.fn(),
  analyzeBotCompatibility: vi.fn(),
}));

vi.mock("../../services/whatsapp-conversations.service", () => ({
  listClientsForChat: vi.fn(), getConversation: vi.fn(), sendConversationMessage: vi.fn(),
  addConversationNote: vi.fn(), listConversationNotes: vi.fn(), sendConversationTemplate: vi.fn(),
  sendConversationMedia: vi.fn(), sendConversationReaction: vi.fn(), markConversationRead: vi.fn(),
  resolveConversationId: mocks.resolveConversationId, startConversationByClientId: vi.fn(),
  startConversationByPhone: vi.fn(), retryFailedMessage: vi.fn(), getMediaById: vi.fn(),
  updateMediaStorageKey: vi.fn(), linkClientToConversation: vi.fn(), getConversationPhone: vi.fn(),
  listSavedStickers: vi.fn(), saveSticker: vi.fn(), deleteSavedSticker: vi.fn(),
  listQuickReplies: vi.fn(), createQuickReply: vi.fn(), updateQuickReply: vi.fn(),
  deleteQuickReply: vi.fn(), transferConversation: vi.fn(), transferConversationToUser: vi.fn(),
  transferConversationToSector: vi.fn(), setContactWhatsappTags: vi.fn(), closeConversation: vi.fn(),
  reopenConversation: vi.fn(), isConversationAccessibleToUser: mocks.isConversationAccessibleToUser,
  isClientAccessibleToUser: vi.fn(), resolveOutboundChannelForSender: mocks.resolveOutboundChannelForSender,
  forwardConversationMessage: vi.fn(), getConversationCapabilities: vi.fn(),
  listWhatsappTagsForFilter: vi.fn(), normalizePhone: (phone: string) => ({ digits: phone, withoutCountry: phone }),
}));
vi.mock("../../services/whatsapp-bot-engine.service", () => ({
  startBotSession: mocks.startBotSession,
  terminateActiveSessionForConversationClose: vi.fn(),
}));
vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: mocks.analyzeBotCompatibility,
  BotCompatibilityLookupError: class BotCompatibilityLookupError extends Error {
    constructor(message: string, public readonly statusCode: 404 | 409) {
      super(message);
    }
  },
}));
vi.mock("../../services/whatsapp-channels.service", () => ({ resolveChannelById: vi.fn() }));

import conversationsRouter from "../whatsapp-conversations.routes";

function makeApp() {
  return createRouteTestApp({
    router: conversationsRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role: "vendedor" })],
  });
}

describe("POST /conversations/:id/trigger-bot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveConversationId.mockResolvedValue("conversation-1");
    mocks.isConversationAccessibleToUser.mockResolvedValue(true);
    mocks.resolveOutboundChannelForSender.mockResolvedValue({
      channelId: 17,
      targetPhone: "5511999999999",
    });
  });

  it("rejeita bot incompatível antes de iniciar a sessão", async () => {
    mocks.analyzeBotCompatibility.mockResolvedValue({
      compatible: false,
      provider: "evolution",
      issues: [{ nodeId: "template", code: "CLOUD_ONLY_NODE", message: "Cloud only" }],
    });

    const response = await request(makeApp())
      .post("/api/whatsapp/conversations/conversation-1/trigger-bot")
      .send({ botId: "bot-meta", channelId: 17 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("BOT_INCOMPATIBLE_CHANNEL");
    expect(mocks.startBotSession).not.toHaveBeenCalled();
  });

  it("inicia normalmente um bot compatível", async () => {
    mocks.analyzeBotCompatibility.mockResolvedValue({
      compatible: true,
      provider: "evolution",
      issues: [],
    });
    mocks.startBotSession.mockResolvedValue({ status: "started" });

    const response = await request(makeApp())
      .post("/api/whatsapp/conversations/conversation-1/trigger-bot")
      .send({ botId: "bot-plain", channelId: 17 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
