import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação; a rota de conversas o puxa
// transitivamente (service → db, sse-hub, baileys/session-manager).
vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../lib/sse-hub", () => ({
  addSseClient: () => () => {},
  addConversationSseClient: () => () => {},
  publishConversationEvent: () => {},
  publishSseEvent: () => {},
  revokeStaleConversationAccess: async () => {},
}));

const { startByClientIdMock, startByPhoneMock } = vi.hoisted(() => ({
  startByClientIdMock: vi.fn(),
  startByPhoneMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-conversations.service", () => ({
  startConversationByClientId: startByClientIdMock,
  startConversationByPhone: startByPhoneMock,
  // Demais exports usados pelo módulo de rotas — não exercidos por estes testes.
  listClientsForChat: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  sendConversationMedia: vi.fn(),
  sendConversationTemplate: vi.fn(),
  sendConversationReaction: vi.fn(),
  retryFailedMessage: vi.fn(),
  addConversationNote: vi.fn(),
  listConversationNotes: vi.fn(),
  getMediaById: vi.fn(),
  markConversationRead: vi.fn(),
  resolveConversationId: vi.fn(),
  resolveConversationIdByClientId: vi.fn(),
  linkClientToConversation: vi.fn(),
  transferConversation: vi.fn(),
  transferConversationToUser: vi.fn(),
  transferConversationToSector: vi.fn(),
  closeConversation: vi.fn(),
  reopenConversation: vi.fn(),
  isConversationAccessibleToUser: vi.fn(),
  isClientAccessibleToUser: vi.fn(),
  setContactWhatsappTags: vi.fn(),
  listWhatsappTagsForFilter: vi.fn(),
  listSavedStickers: vi.fn(),
  saveSticker: vi.fn(),
  deleteSavedSticker: vi.fn(),
  isStickerSaved: vi.fn(),
  listQuickReplies: vi.fn(),
  createQuickReply: vi.fn(),
  updateQuickReply: vi.fn(),
  deleteQuickReply: vi.fn(),
  getConversationPhone: vi.fn(),
  normalizePhone: (phone: string) => ({ digits: phone, withoutCountry: phone }),
}));

import conversationsRouter from "../whatsapp-conversations.routes";

function makeApp(role = "vendedor") {
  return createRouteTestApp({
    router: conversationsRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role })],
  });
}

describe("POST /conversations/start", () => {
  beforeEach(() => {
    startByClientIdMock.mockReset();
    startByPhoneMock.mockReset();
  });

  it("aceita clientId e delega para startConversationByClientId", async () => {
    startByClientIdMock.mockResolvedValue({ conversationId: "c1", clientId: "cli1" });

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ clientId: "cli1", channelId: 7 });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe("c1");
    expect(startByClientIdMock).toHaveBeenCalledWith("cli1", "u1", "vendedor", 7);
    expect(startByPhoneMock).not.toHaveBeenCalled();
  });

  it("aceita phone avulso e delega para startConversationByPhone", async () => {
    startByPhoneMock.mockResolvedValue({ conversationId: "c2", clientId: null });

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ phone: "5521988887777", channelId: 7 });

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe("c2");
    expect(startByPhoneMock).toHaveBeenCalledWith("5521988887777", "u1", "vendedor", 7);
    expect(startByClientIdMock).not.toHaveBeenCalled();
  });

  it("rejeita corpo sem clientId nem phone", async () => {
    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ channelId: 7 });

    expect(res.status).toBe(400);
    expect(startByPhoneMock).not.toHaveBeenCalled();
    expect(startByClientIdMock).not.toHaveBeenCalled();
  });

  it("devolve 403 quando o canal pedido não é acessível ao usuário", async () => {
    startByPhoneMock.mockRejectedValue(new Error("CHANNEL_NOT_ACCESSIBLE"));

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ phone: "5521988887777", channelId: 99 });

    expect(res.status).toBe(403);
  });

  it("devolve 400 para telefone inválido", async () => {
    startByPhoneMock.mockRejectedValue(new Error("INVALID_PHONE"));

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ phone: "abc" });

    expect(res.status).toBe(400);
  });

  it("devolve 400 ao tentar conversar com o número do próprio canal", async () => {
    startByPhoneMock.mockRejectedValue(new Error("SAME_CHANNEL_PHONE"));

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/start")
      .send({ phone: "5521989014965", channelId: 7 });

    expect(res.status).toBe(400);
  });
});
