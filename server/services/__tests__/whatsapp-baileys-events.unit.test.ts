import { describe, expect, it, vi, beforeEach } from "vitest";

// handleMessagesUpdate é a única função exercida aqui. Os módulos abaixo são
// puramente side-effect (DB real, integrações externas, engine de bot) e
// irrelevantes para a lógica pura de "mapear status do Baileys + detectar 463".
const { updateMock, setMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { update: updateMock } }));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelByEvolutionInstance: async () => null,
  updateConnectionStatus: async () => {},
  updateChannel: async () => {},
  isSameChannelPhone: () => false,
  listQrReaderUserIdsForChannel: async () => [],
}));
vi.mock("../whatsapp-conversations.service", () => ({
  saveInboundMessage: async () => {},
  saveInboundReaction: async () => {},
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

import { handleMessagesUpdate } from "../whatsapp-baileys-events.service";

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
