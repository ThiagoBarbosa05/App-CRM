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

const {
  resolveConversationIdMock,
  isConversationAccessibleToUserMock,
  markConversationReadMock,
  closeConversationMock,
  reopenConversationMock,
} = vi.hoisted(
  () => ({
    resolveConversationIdMock: vi.fn(),
    isConversationAccessibleToUserMock: vi.fn(),
    markConversationReadMock: vi.fn(),
    closeConversationMock: vi.fn(),
    reopenConversationMock: vi.fn(),
  }),
);

vi.mock("../../services/whatsapp-conversations.service", () => ({
  resolveConversationId: resolveConversationIdMock,
  isConversationAccessibleToUser: isConversationAccessibleToUserMock,
  markConversationRead: markConversationReadMock,
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
  startConversationByClientId: vi.fn(),
  startConversationByPhone: vi.fn(),
  resolveConversationIdByClientId: vi.fn(),
  linkClientToConversation: vi.fn(),
  transferConversation: vi.fn(),
  transferConversationToUser: vi.fn(),
  transferConversationToSector: vi.fn(),
  closeConversation: closeConversationMock,
  reopenConversation: reopenConversationMock,
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

function makeApp(role = "admin") {
  return createRouteTestApp({
    router: conversationsRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role })],
  });
}

describe("POST /conversations/:clientId/read", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset();
    isConversationAccessibleToUserMock.mockReset();
    markConversationReadMock.mockReset();
    resolveConversationIdMock.mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockResolvedValue(true);
    markConversationReadMock.mockResolvedValue(undefined);
  });

  it("repassa asChannelId e o papel do usuário para markConversationRead", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/read")
      .send({ asChannelId: 12 });

    expect(res.status).toBe(200);
    expect(markConversationReadMock).toHaveBeenCalledWith("u1", "c1", {
      userRole: "admin",
      asChannelId: 12,
    });
  });

  it("corpo ausente vira asChannelId undefined — marcação da conversa inteira", async () => {
    const res = await request(makeApp("admin")).post("/api/whatsapp/conversations/c1/read");

    expect(res.status).toBe(200);
    expect(markConversationReadMock).toHaveBeenCalledWith("u1", "c1", {
      userRole: "admin",
      asChannelId: undefined,
    });
  });

  it("asChannelId inválido (string) degrada para undefined em vez de 400 — mesmo contrato do GET", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/read")
      .send({ asChannelId: "abc" });

    expect(res.status).toBe(200);
    expect(markConversationReadMock).toHaveBeenCalledWith("u1", "c1", {
      userRole: "admin",
      asChannelId: undefined,
    });
  });

  it("asChannelId negativo degrada para undefined em vez de 400", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/read")
      .send({ asChannelId: -1 });

    expect(res.status).toBe(200);
    expect(markConversationReadMock).toHaveBeenCalledWith("u1", "c1", {
      userRole: "admin",
      asChannelId: undefined,
    });
  });

  it("repassa o papel vendedor — a autorização do lado fica a cargo de resolvePerspectiveOverride no service", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/whatsapp/conversations/c1/read")
      .send({ asChannelId: 12 });

    expect(res.status).toBe(200);
    expect(markConversationReadMock).toHaveBeenCalledWith("u1", "c1", {
      userRole: "vendedor",
      asChannelId: 12,
    });
  });

  it("404 quando a conversa não é resolvida — não chama markConversationRead", async () => {
    resolveConversationIdMock.mockResolvedValue(null);

    const res = await request(makeApp()).post("/api/whatsapp/conversations/unknown/read").send({});

    expect(res.status).toBe(404);
    expect(markConversationReadMock).not.toHaveBeenCalled();
  });

  it("403 quando a conversa não é acessível ao usuário — não chama markConversationRead", async () => {
    isConversationAccessibleToUserMock.mockResolvedValue(false);

    const res = await request(makeApp()).post("/api/whatsapp/conversations/c1/read").send({});

    expect(res.status).toBe(403);
    expect(markConversationReadMock).not.toHaveBeenCalled();
  });
});

describe("encerramento por perspectiva", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset().mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockReset().mockResolvedValue(true);
    closeConversationMock.mockReset().mockResolvedValue({
      id: "c1",
      phone: "5522999999999",
      peerChannelId: 12,
    });
    reopenConversationMock.mockReset().mockResolvedValue({
      id: "c1",
      phone: "5522999999999",
      peerChannelId: 12,
    });
  });

  it("encerra somente a perspectiva informada pelo admin", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/close")
      .send({ asChannelId: 12 });

    expect(res.status).toBe(200);
    expect(closeConversationMock).toHaveBeenCalledWith("c1", "u1", "admin", 12);
  });

  it("reabre somente a perspectiva informada pelo admin", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/reopen")
      .send({ asChannelId: 7 });

    expect(res.status).toBe(200);
    expect(reopenConversationMock).toHaveBeenCalledWith("c1", "u1", "admin", 7);
  });

  it("rejeita uma perspectiva malformada antes de chamar o serviço", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/close")
      .send({ asChannelId: -1 });

    expect(res.status).toBe(400);
    expect(closeConversationMock).not.toHaveBeenCalled();
  });
});
