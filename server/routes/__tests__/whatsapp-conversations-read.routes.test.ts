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
  searchConversationMessagesMock,
  getConversationMessageContextMock,
  updateConversationCustomContactNameMock,
  sendConversationMessageMock,
  WhatsappCustomerWindowClosedErrorMock,
} = vi.hoisted(
  () => {
    class WhatsappCustomerWindowClosedErrorMock extends Error {
      readonly code = "WHATSAPP_CUSTOMER_WINDOW_CLOSED";
      readonly httpStatus = 409;
    }
    return {
    resolveConversationIdMock: vi.fn(),
    isConversationAccessibleToUserMock: vi.fn(),
    markConversationReadMock: vi.fn(),
    closeConversationMock: vi.fn(),
    reopenConversationMock: vi.fn(),
    searchConversationMessagesMock: vi.fn(),
    getConversationMessageContextMock: vi.fn(),
    updateConversationCustomContactNameMock: vi.fn(),
    sendConversationMessageMock: vi.fn(),
    WhatsappCustomerWindowClosedErrorMock,
    };
  },
);

vi.mock("../../services/whatsapp-conversations.service", () => ({
  resolveConversationId: resolveConversationIdMock,
  isConversationAccessibleToUser: isConversationAccessibleToUserMock,
  markConversationRead: markConversationReadMock,
  // Demais exports usados pelo módulo de rotas — não exercidos por estes testes.
  listClientsForChat: vi.fn(),
  getConversation: vi.fn(),
  sendConversationMessage: sendConversationMessageMock,
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
  searchConversationMessages: searchConversationMessagesMock,
  getConversationMessageContext: getConversationMessageContextMock,
  updateConversationCustomContactName: updateConversationCustomContactNameMock,
  WhatsappCustomerWindowClosedError: WhatsappCustomerWindowClosedErrorMock,
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

describe("PATCH /conversations/:conversationId/contact-name", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset();
    isConversationAccessibleToUserMock.mockReset();
    updateConversationCustomContactNameMock.mockReset();
  });

  it("normaliza e salva o nome personalizado da conversa acessível", async () => {
    resolveConversationIdMock.mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockResolvedValue(true);
    updateConversationCustomContactNameMock.mockResolvedValue({ id: "c1", customContactName: "Dona Maria" });

    const response = await request(makeApp("vendedor"))
      .patch("/api/whatsapp/conversations/c1/contact-name")
      .send({ name: "  Dona Maria  " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "c1", customContactName: "Dona Maria" });
    expect(updateConversationCustomContactNameMock).toHaveBeenCalledWith("c1", "Dona Maria");
  });

  it("remove o nome personalizado quando recebe texto vazio", async () => {
    resolveConversationIdMock.mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockResolvedValue(true);
    updateConversationCustomContactNameMock.mockResolvedValue({ id: "c1", customContactName: null });

    const response = await request(makeApp())
      .patch("/api/whatsapp/conversations/c1/contact-name")
      .send({ name: "   " });

    expect(response.status).toBe(200);
    expect(updateConversationCustomContactNameMock).toHaveBeenCalledWith("c1", null);
  });

  it("nega alteração quando o atendente não pode acessar a conversa", async () => {
    resolveConversationIdMock.mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockResolvedValue(false);

    const response = await request(makeApp("vendedor"))
      .patch("/api/whatsapp/conversations/c1/contact-name")
      .send({ name: "Apelido" });

    expect(response.status).toBe(403);
    expect(updateConversationCustomContactNameMock).not.toHaveBeenCalled();
  });
});

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
    markConversationReadMock.mockResolvedValue({ local: true, remote: "sent" });
    const res = await request(makeApp("admin"))
      .post("/api/whatsapp/conversations/c1/read")
      .send({ asChannelId: 12 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, local: true, remote: "sent" });
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

describe("POST /conversations/:clientId/messages", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset().mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockReset().mockResolvedValue(true);
    sendConversationMessageMock.mockReset();
  });

  it("expõe um erro tipado sem detalhe técnico quando a janela Cloud API terminou", async () => {
    sendConversationMessageMock.mockRejectedValue(new WhatsappCustomerWindowClosedErrorMock());

    const response = await request(makeApp())
      .post("/api/whatsapp/conversations/c1/messages")
      .send({ message: "Olá" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "WHATSAPP_CUSTOMER_WINDOW_CLOSED",
      message: "A janela de atendimento de 24 horas foi encerrada",
      hint: "Envie um template aprovado para retomar a conversa.",
    });
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

describe("busca no histórico da conversa", () => {
  beforeEach(() => {
    resolveConversationIdMock.mockReset().mockResolvedValue("c1");
    isConversationAccessibleToUserMock.mockReset().mockResolvedValue(true);
    searchConversationMessagesMock.mockReset().mockResolvedValue({
      results: [{ id: "m1", content: "Pedido confirmado" }],
      total: 1,
      nextCursor: null,
    });
    getConversationMessageContextMock.mockReset().mockResolvedValue({
      conversation: { id: "c1", lastInboundAt: null },
      messages: [{ id: "m1", content: "Pedido confirmado" }],
      nextCursor: "older",
    });
  });

  it("exige pelo menos dois caracteres", async () => {
    const response = await request(makeApp()).get(
      "/api/whatsapp/conversations/c1/messages/search?query=p",
    );

    expect(response.status).toBe(400);
    expect(searchConversationMessagesMock).not.toHaveBeenCalled();
  });

  it("pagina e delega a busca somente após validar o acesso", async () => {
    const response = await request(makeApp("vendedor")).get(
      "/api/whatsapp/conversations/c1/messages/search?query=pedido&limit=99",
    );

    expect(response.status).toBe(200);
    expect(isConversationAccessibleToUserMock).toHaveBeenCalledWith("c1", "u1", "vendedor");
    expect(searchConversationMessagesMock).toHaveBeenCalledWith("c1", "pedido", {
      cursor: null,
      limit: 25,
    });
  });

  it("não revela uma conversa fora do escopo", async () => {
    isConversationAccessibleToUserMock.mockResolvedValue(false);

    const response = await request(makeApp("vendedor")).get(
      "/api/whatsapp/conversations/c1/messages/search?query=pedido",
    );

    expect(response.status).toBe(404);
    expect(searchConversationMessagesMock).not.toHaveBeenCalled();
  });

  it("carrega o contexto com a perspectiva do canal", async () => {
    const response = await request(makeApp("admin")).get(
      "/api/whatsapp/conversations/c1/messages/m1/context?asChannelId=12",
    );

    expect(response.status).toBe(200);
    expect(getConversationMessageContextMock).toHaveBeenCalledWith(
      "c1",
      "m1",
      "u1",
      "admin",
      { asChannelId: 12 },
    );
    expect(response.body.anchorMessageId).toBe("m1");
  });
});
