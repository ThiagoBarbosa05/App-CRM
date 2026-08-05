import { describe, expect, it, vi, beforeEach } from "vitest";
import { whatsappCampaignMessages, whatsappMessages } from "@shared/schema";

// applyCampaignDeliveryStatus faz até duas consultas de SELECT em sequência
// (match direto em whatsapp_campaign_messages; se vazio, fallback via FK em
// whatsapp_messages e depois um segundo SELECT em whatsapp_campaign_messages
// pelo id encontrado) seguidas de um UPDATE condicional. Mockamos `db` com
// filas de resposta por tabela (uma entrada por chamada, na ordem em que
// `select().from(table)` é invocado) e capturamos os argumentos do UPDATE.
const { selectMock, updateMock, setMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { select: selectMock, update: updateMock } }));

import { applyCampaignDeliveryStatus, STATUS_RANK } from "../whatsapp-campaign-status.service";

type CampaignMessageRow = typeof whatsappCampaignMessages.$inferSelect;

function baseCampaignMessage(overrides: Partial<CampaignMessageRow> = {}): CampaignMessageRow {
  return {
    id: "cm-1",
    campaignId: "camp-1",
    contactId: "client-1",
    contactName: "Fulano",
    phoneNumber: "+5511999990000",
    phoneNormalized: "+5511999990000",
    contentFingerprint: "fp-1",
    status: "sent",
    scheduledAt: new Date("2026-08-04T10:00:00Z"),
    sentAt: new Date("2026-08-04T10:00:00Z"),
    deliveredAt: null,
    readAt: null,
    errorMessage: null,
    suppressionReason: null,
    conflictingCampaignMessageId: null,
    tagApplicationStatus: "not_requested",
    tagApplicationError: null,
    messageId: "wamid-1",
    attempts: 1,
    nextAttemptAt: null,
    createdAt: new Date("2026-08-04T10:00:00Z"),
    updatedAt: new Date("2026-08-04T10:00:00Z"),
    ...overrides,
  };
}

// Fila de respostas por tabela: cada chamada a select().from(table) consome o
// próximo array da fila daquela tabela (na ordem em que foi enfileirado).
function mockSelectQueues(queues: { campaignMessages?: unknown[][]; messages?: unknown[][] }) {
  const campaignQueue = [...(queues.campaignMessages ?? [])];
  const messagesQueue = [...(queues.messages ?? [])];

  selectMock.mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: () => {
          if (table === whatsappCampaignMessages) {
            return Promise.resolve(campaignQueue.shift() ?? []);
          }
          if (table === whatsappMessages) {
            return Promise.resolve(messagesQueue.shift() ?? []);
          }
          throw new Error(`select inesperado em tabela desconhecida: ${String(table)}`);
        },
      }),
    }),
  }));
}

describe("applyCampaignDeliveryStatus", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
    setMock.mockReset();
    setMock.mockReturnValue({ where: () => Promise.resolve(undefined) });
    updateMock.mockReturnValue({ set: setMock });
  });

  it("match direto por messageId: sent -> delivered atualiza status e deliveredAt", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "sent" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "delivered", { eventAt: new Date("2026-08-04T11:00:00Z") });

    expect(updateMock).toHaveBeenCalledWith(whatsappCampaignMessages);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    );
  });

  it("sem match direto: usa fallback via FK whatsapp_messages.campaignMessageId", async () => {
    mockSelectQueues({
      campaignMessages: [
        [], // match direto: nada
        [baseCampaignMessage({ id: "cm-fallback", status: "sent", messageId: null as unknown as string })],
      ],
      messages: [[{ campaignMessageId: "cm-fallback" }]],
    });

    await applyCampaignDeliveryStatus("wamid-bot", "delivered", { eventAt: new Date("2026-08-04T11:00:00Z") });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    );
  });

  it("nenhum match (direto nem fallback): não faz nada", async () => {
    mockSelectQueues({
      campaignMessages: [[]],
      messages: [[]],
    });

    await applyCampaignDeliveryStatus("wamid-desconhecido", "delivered", { eventAt: new Date() });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("downgrade de rank é ignorado (já delivered, chega sent)", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "delivered" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "sent", { eventAt: new Date() });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("repetição do mesmo status (rank igual) é ignorada", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "delivered" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "delivered", { eventAt: new Date() });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("failed grava errorMessage e status failed, sem tocar em impact/releaseImpact", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "sent" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "failed", {
      eventAt: new Date("2026-08-04T11:00:00Z"),
      errorMessage: "Número inválido",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "Número inválido" }),
    );
    // O serviço não importa nem chama releaseImpact/whatsappCampaignImpacts —
    // a única tabela tocada por update é whatsapp_campaign_messages.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(whatsappCampaignMessages);
  });

  it("failed sem errorMessage explícito usa fallback padrão", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "sent" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "failed", { eventAt: new Date() });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "Falha reportada pelo canal" }),
    );
  });

  it("estado terminal failed: nenhum novo status é aplicado", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "failed" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "read", { eventAt: new Date() });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("estado terminal cancelled: nenhum novo status é aplicado", async () => {
    mockSelectQueues({ campaignMessages: [[baseCampaignMessage({ status: "cancelled" })]] });

    await applyCampaignDeliveryStatus("wamid-1", "delivered", { eventAt: new Date() });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("STATUS_RANK é monotônico scheduled < sent < delivered < read", () => {
    expect(STATUS_RANK.scheduled).toBeLessThan(STATUS_RANK.sent);
    expect(STATUS_RANK.sent).toBeLessThan(STATUS_RANK.delivered);
    expect(STATUS_RANK.delivered).toBeLessThan(STATUS_RANK.read);
  });
});
