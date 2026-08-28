import { describe, expect, it, vi, beforeEach } from "vitest";

// handleMessagesUpdate é a única função exercida aqui. Os módulos abaixo são
// puramente side-effect (DB real, integrações externas, engine de bot) e
// irrelevantes para a lógica pura de "mapear status do Baileys + detectar 463".
const {
  updateMock,
  setMock,
  saveInboundMessageMock,
  saveInboundReactionMock,
  getChannelMock,
  applyCampaignDeliveryStatusMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  setMock: vi.fn(),
  saveInboundMessageMock: vi.fn(),
  saveInboundReactionMock: vi.fn(),
  getChannelMock: vi.fn(),
  applyCampaignDeliveryStatusMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { update: updateMock } }));
vi.mock("../whatsapp-campaign-status.service", () => ({
  applyCampaignDeliveryStatus: applyCampaignDeliveryStatusMock,
}));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelByEvolutionInstance: getChannelMock,
  updateChannel: async () => {},
  isSameChannelPhone: () => false,
  listQrReaderUserIdsForChannel: async () => [],
  invalidateChannelDirectory: () => {},
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
  handleInboundBotMessage: async () => {},
}));
vi.mock("../baileys/connection-events.service", () => ({
  logChannelConnectionEvent: async () => {},
}));
vi.mock("../baileys/connection-status.service", () => ({
  applyChannelConnectionStatus: async () => ({ applied: true, status: "connected", reason: "changed" }),
  getSseTargetUserIds: async () => [],
}));

import {
  extractQuotedMessageSnapshot,
  handleMessagesDelete,
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

  it("normaliza uma resposta achatada enviada pelo dispositivo", async () => {
    const flattenedText = "_Em resposta à: De R$ 1.399,90 por R$ 839.9..._:\n\n5 grfs";

    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: true,
        id: "resposta-achatada-1",
      },
      message: {
        extendedTextMessage: {
          text: flattenedText,
          contextInfo: {
            isForwarded: false,
            forwardingScore: 0,
          },
        },
      },
      messageTimestamp: 1_700_000_000,
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      content: "5 grfs",
      replyToContentSnapshot: "De R$ 1.399,90 por R$ 839.9...",
      replyToTypeSnapshot: "text",
      replyToDirectionSnapshot: "inbound",
      rawPayload: expect.objectContaining({
        message: expect.objectContaining({
          extendedTextMessage: expect.objectContaining({ text: flattenedText }),
        }),
      }),
    }));
  });

  it("persiste a legenda de uma imagem enviada pelo dispositivo no campo caption", async () => {
    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: true,
        id: "imagem-com-legenda-1",
      },
      message: {
        imageMessage: {
          caption: "Foto do produto",
          mimetype: "image/jpeg",
        },
      },
      messageTimestamp: 1_700_000_000,
      _baileysMedia: {
        storageKey: "whatsapp/imagem-com-legenda-1.jpg",
        mimeType: "image/jpeg",
        filename: null,
        size: 12_345,
      },
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "image",
      content: null,
      caption: "Foto do produto",
      _fromMe: true,
    }));
  });

  it("preserva uma localização recebida como conteúdo estruturado", async () => {
    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: false,
        id: "localizacao-1",
      },
      message: {
        locationMessage: {
          degreesLatitude: -22.9068,
          degreesLongitude: -43.1729,
          name: "Centro",
          address: "Rio de Janeiro - RJ",
        },
      },
      messageTimestamp: 1_700_000_000,
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "location",
      content: "Centro",
      providerMetadata: {
        location: {
          latitude: -22.9068,
          longitude: -43.1729,
          name: "Centro",
          address: "Rio de Janeiro - RJ",
        },
        structuredContent: {
          kind: "location",
          latitude: -22.9068,
          longitude: -43.1729,
          name: "Centro",
          address: "Rio de Janeiro - RJ",
        },
      },
    }));
  });

  it("preserva cartões de contato recebidos como conteúdo estruturado", async () => {
    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: false,
        id: "contatos-1",
      },
      message: {
        contactsArrayMessage: {
          displayName: "Equipe comercial",
          contacts: [{ displayName: "Ana", vcard: "BEGIN:VCARD\\nFN:Ana\\nEND:VCARD" }],
        },
      },
      messageTimestamp: 1_700_000_000,
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "contacts",
      content: "Equipe comercial",
      providerMetadata: {
        contacts: [{ displayName: "Ana", vcard: "BEGIN:VCARD\\nFN:Ana\\nEND:VCARD" }],
        structuredContent: {
          kind: "contacts",
          contacts: [{
            name: { formatted_name: "Ana" },
            displayName: "Ana",
            vcard: "BEGIN:VCARD\\nFN:Ana\\nEND:VCARD",
          }],
        },
      },
    }));
  });

  it("preserva enquete recebida e não a descarta como mensagem vazia", async () => {
    await handleMessagesUpsert("canal-qr", {
      key: {
        remoteJid: "5521888888888@s.whatsapp.net",
        fromMe: false,
        id: "enquete-1",
      },
      message: {
        pollCreationMessage: {
          name: "Qual horário?",
          options: [{ optionName: "Manhã" }, { optionName: "Tarde" }],
          selectableOptionsCount: 1,
        },
      },
      messageTimestamp: 1_700_000_000,
    });

    expect(saveInboundMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "poll",
      content: "Qual horário?",
      providerMetadata: {
        poll: {
          options: ["Manhã", "Tarde"],
          selectableCount: 1,
        },
        structuredContent: {
          kind: "poll",
          poll: {
            name: "Qual horário?",
            options: [{ name: "Manhã" }, { name: "Tarde" }],
            selectableOptionsCount: 1,
          },
        },
      },
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

describe("handleMessagesDelete", () => {
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

  it("marca a mensagem removida pelo WhatsApp sem apagar seu registro de auditoria", async () => {
    await handleMessagesDelete({
      keys: [{ id: "mensagem-removida", remoteJid: "5521888888888@s.whatsapp.net" }],
    });

    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "deleted",
      content: null,
      caption: null,
    }));
  });
});

describe("handleMessagesUpdate — detecção de conta restrita (erro 463)", () => {
  beforeEach(() => {
    updateMock.mockReset();
    setMock.mockReset();
    applyCampaignDeliveryStatusMock.mockReset();
    applyCampaignDeliveryStatusMock.mockResolvedValue(undefined);
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

describe("handleMessagesUpdate — propagação pra applyCampaignDeliveryStatus", () => {
  beforeEach(() => {
    updateMock.mockReset();
    setMock.mockReset();
    applyCampaignDeliveryStatusMock.mockReset();
    applyCampaignDeliveryStatusMock.mockResolvedValue(undefined);
    setMock.mockReturnValue({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    });
    updateMock.mockReturnValue({ set: setMock });
  });

  it("chama applyCampaignDeliveryStatus com waMessageId, status mapeado e eventAt", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-6" }, update: { status: "delivery_ack" } },
    ]);

    expect(applyCampaignDeliveryStatusMock).toHaveBeenCalledTimes(1);
    expect(applyCampaignDeliveryStatusMock).toHaveBeenCalledWith(
      "wamid-6",
      "delivered",
      expect.objectContaining({ eventAt: expect.any(Date) }),
    );
  });

  it("propaga o statusReason de conta restrita (463) como errorMessage", async () => {
    await handleMessagesUpdate([
      { key: { id: "wamid-7" }, update: { status: "error", messageStubParameters: ["463"] } },
    ]);

    expect(applyCampaignDeliveryStatusMock).toHaveBeenCalledWith(
      "wamid-7",
      "failed",
      expect.objectContaining({ errorMessage: "account_restricted" }),
    );
  });

  it("é chamada incondicionalmente mesmo quando o UPDATE de whatsapp_messages não retorna linha (returning vazio)", async () => {
    // setMock().where().returning() já resolve [] no beforeEach — simula o
    // WHERE de monotonicidade barrando o update de whatsapp_messages (ex:
    // já estava "read" e chegou "delivered"). Mesmo assim a campanha deve
    // ser verificada, porque tem sua própria checagem de rank independente.
    await handleMessagesUpdate([
      { key: { id: "wamid-8" }, update: { status: "delivery_ack" } },
    ]);

    expect(applyCampaignDeliveryStatusMock).toHaveBeenCalledTimes(1);
  });

  it("erro em applyCampaignDeliveryStatus não propaga (fire-and-forget com .catch)", async () => {
    applyCampaignDeliveryStatusMock.mockRejectedValue(new Error("boom"));

    await expect(
      handleMessagesUpdate([{ key: { id: "wamid-9" }, update: { status: "read" } }]),
    ).resolves.toBeUndefined();
  });
});
