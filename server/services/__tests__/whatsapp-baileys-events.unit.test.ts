import { describe, expect, it, vi, beforeEach } from "vitest";

// handleMessagesUpdate é a única função exercida aqui. Os módulos abaixo são
// puramente side-effect (DB real, integrações externas, engine de bot) e
// irrelevantes para a lógica pura de "mapear status do Baileys + detectar 463".
const { updateMock, setMock, saveInboundMessageMock, saveInboundReactionMock, getChannelMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  setMock: vi.fn(),
  saveInboundMessageMock: vi.fn(),
  saveInboundReactionMock: vi.fn(),
  getChannelMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { update: updateMock } }));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelByEvolutionInstance: getChannelMock,
  updateConnectionStatus: async () => {},
  updateChannel: async () => {},
  isSameChannelPhone: () => false,
  listQrReaderUserIdsForChannel: async () => [],
}));
vi.mock("../whatsapp-conversations.service", () => ({
  saveInboundMessage: saveInboundMessageMock,
  saveInboundReaction: saveInboundReactionMock,
}));
vi.mock("../../lib/sse-hub", () => ({
  publishSseEvent: () => {},
  publishConversationEvent: () => {},
}));
vi.mock("../baileys/jid", () => ({
  jidToPhone: (jid: string) => jid,
  isIgnorableJid: () => false,
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: async () => null,
}));
vi.mock("../whatsapp-opt-out.service", () => ({
  optOutClientByPhone: async () => {},
  optInClientByPhone: async () => {},
  matchOptKeyword: () => null,
  OPT_OUT_CONFIRMATION_TEXT: "",
  OPT_IN_CONFIRMATION_TEXT: "",
}));
vi.mock("../whatsapp-bot-engine.service", () => ({
  persistBotMessage: async () => {},
}));
vi.mock("../baileys/connection-events.service", () => ({
  logChannelConnectionEvent: async () => {},
}));

import {
  extractQuotedMessageSnapshot,
  handleMessagesReaction,
  handleMessagesUpsert,
  handleMessagesUpdate,
} from "../whatsapp-baileys-events.service";

describe("eventos de interação do dispositivo", () => {
  beforeEach(() => {
    saveInboundMessageMock.mockReset();
    saveInboundReactionMock.mockReset();
    getChannelMock.mockReset();
    getChannelMock.mockResolvedValue({
      id: 7,
      name: "Canal QR",
      displayPhone: "5521999999999",
    });
    saveInboundMessageMock.mockResolvedValue({ saved: true, channelId: 7 });
  });

  it("usa a key externa como mensagem alvo da reação", async () => {
    await handleMessagesReaction("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: false,
        id: "mensagem-original",
      },
      reaction: {
        key: {
          remoteJid: "5521888888888@s.whatsapp.net",
          fromMe: true,
          id: "evento-reacao",
        },
        text: "👍",
      },
    });

    expect(saveInboundReactionMock).toHaveBeenCalledWith(expect.objectContaining({
      waMessageId: "mensagem-original",
      emoji: "👍",
      direction: "outbound",
    }));
  });

  it("preserva a referência e o snapshot de uma resposta enviada pelo dispositivo", async () => {
    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: true,
        id: "resposta-1",
      },
      message: {
        extendedTextMessage: {
          text: "Teste",
          contextInfo: {
            stanzaId: "mensagem-original",
            participant: "5521888888888@s.whatsapp.net",
            quotedMessage: { conversation: "1" },
          },
        },
      },
      messageTimestamp: 1_700_000_000,
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      replyToWaMessageId: "mensagem-original",
      replyToContentSnapshot: "1",
      replyToTypeSnapshot: "text",
      content: "Teste",
      _fromMe: true,
    }));
  });
});

describe("extractQuotedMessageSnapshot", () => {
  it("preserva o texto de uma mensagem citada", () => {
    expect(extractQuotedMessageSnapshot({ conversation: "1" })).toEqual({
      content: "1",
      type: "text",
    });
    expect(extractQuotedMessageSnapshot({
      extendedTextMessage: { text: "Mensagem original" },
    })).toEqual({ content: "Mensagem original", type: "text" });
  });

  it.each([
    ["imageMessage", "image", "Foto do produto"],
    ["videoMessage", "video", "Demonstração"],
    ["audioMessage", "audio", ""],
    ["documentMessage", "document", "pedido.pdf"],
    ["stickerMessage", "sticker", ""],
  ])("cria snapshot de %s", (messageKey, expectedType, expectedContent) => {
    const media = messageKey === "documentMessage"
      ? { fileName: expectedContent }
      : expectedContent ? { caption: expectedContent } : {};

    expect(extractQuotedMessageSnapshot({ [messageKey]: media })).toEqual({
      content: expectedContent,
      type: expectedType,
    });
  });

  it("ignora payload sem conteúdo citado reconhecido", () => {
    expect(extractQuotedMessageSnapshot(undefined)).toBeNull();
    expect(extractQuotedMessageSnapshot({ protocolMessage: {} })).toBeNull();
  });
});

describe("handleMessagesUpdate — detecção de conta restrita (erro 463)", () => {
  beforeEach(() => {
    updateMock.mockReset();
    setMock.mockReset();
    setMock.mockReturnValue({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    });
    updateMock.mockReturnValue({ set: setMock });
  });

  it("erro com messageStubParameters ['463'] grava status=failed e statusReason=account_restricted", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-1" }, update: { status: "error", messageStubParameters: ["463"] } },
    ]);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", statusReason: "account_restricted" }),
    );
  });

  it("reach-out timelock ['471', 'Your account has been restricted'] também grava account_restricted", async () => {
    await handleMessagesUpdate([
      {
        key: { id: "wamid-2" },
        update: { status: "error", messageStubParameters: ["471", "Your account has been restricted"] },
      },
    ]);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", statusReason: "account_restricted" }),
    );
  });

  it("erro sem relação com 463 grava failed sem statusReason", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-3" }, update: { status: "error", messageStubParameters: ["479"] } },
    ]);

    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("status de sucesso (delivery_ack) não passa pelo branch de motivo", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-4" }, update: { status: "delivery_ack" } },
    ]);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    );
  });

  it("status read grava entrega e leitura", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-5" }, update: { status: "read" } },
    ]);

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "read",
        deliveredAt: expect.any(Date),
        readAt: expect.any(Date),
      }),
    );
  });
});
