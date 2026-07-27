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

const { resolveConversationIdMock, sendConversationReactionMock } = vi.hoisted(() => ({
  resolveConversationIdMock: vi.fn(),
  sendConversationReactionMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-conversations.service", () => ({
  resolveConversationId: resolveConversationIdMock,
  sendConversationReaction: sendConversationReactionMock,
  // Demais exports usados pelo módulo de rotas — não exercidos por estes testes.
  isConversationAccessibleToUser: vi.fn(),
  markConversationRead: vi.fn(),
  listClientsForChat: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  sendConversationMedia: vi.fn(),
  sendConversationTemplate: vi.fn(),
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
  closeConversation: vi.fn(),
  reopenConversation: vi.fn(),
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

describe("POST /conversations/:clientId/messages/:messageId/reaction", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset();
    sendConversationReactionMock.mockReset();
    resolveConversationIdMock.mockResolvedValue("c1");
    sendConversationReactionMock.mockResolvedValue({ ok: true });
  });

  // É este fio que faz a reação "assinar" pelo lado certo do diálogo interno:
  // o frontend manda o canal da CAIXA aberta (sendAsChannelId), e o service o
  // usa como actAsChannelId. Um channelId descartado aqui reintroduz o bug.
  it("repassa o channelId do corpo como 6º argumento de sendConversationReaction", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/messages/m1/reaction")
      .send({ emoji: "👍", channelId: 12 });

    expect(res.status).toBe(200);
    expect(sendConversationReactionMock).toHaveBeenCalledWith("c1", "m1", "👍", "u1", "admin", 12);
  });

  it("sem channelId no corpo: 6º argumento vira undefined (perspectiva derivada dos canais do usuário)", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/messages/m1/reaction")
      .send({ emoji: "👍" });

    expect(res.status).toBe(200);
    expect(sendConversationReactionMock).toHaveBeenCalledWith("c1", "m1", "👍", "u1", "admin", undefined);
  });

  it("repassa o papel vendedor — o service é quem decide ignorar o override", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/whatsapp/conversations/c1/messages/m1/reaction")
      .send({ emoji: "👍", channelId: 12 });

    expect(res.status).toBe(200);
    expect(sendConversationReactionMock).toHaveBeenCalledWith("c1", "m1", "👍", "u1", "vendedor", 12);
  });

  // Assimetria proposital em relação à rota de leitura, que degrada asChannelId
  // inválido para undefined: um ENVIO não pode escolher canal em silêncio.
  it("channelId inválido é 400, não degradação silenciosa", async () => {
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/messages/m1/reaction")
      .send({ emoji: "👍", channelId: "abc" });

    expect(res.status).toBe(400);
    expect(sendConversationReactionMock).not.toHaveBeenCalled();
  });

  it("404 quando a conversa não é resolvida — não chama sendConversationReaction", async () => {
    resolveConversationIdMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .post("/api/whatsapp/conversations/desconhecida/messages/m1/reaction")
      .send({ emoji: "👍" });

    expect(res.status).toBe(404);
    expect(sendConversationReactionMock).not.toHaveBeenCalled();
  });
});
