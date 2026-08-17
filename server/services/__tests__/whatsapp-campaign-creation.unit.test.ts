import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  campaigns,
  whatsappCampaignImpacts,
  whatsappCampaignMessages,
  whatsappCampaigns,
} from "@shared/schema";

const {
  transactionMock,
  resolveCampaignAudienceMock,
  buildCampaignContentSnapshotMock,
  fingerprintForClientMock,
  reserveCampaignMessageMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  resolveCampaignAudienceMock: vi.fn(),
  buildCampaignContentSnapshotMock: vi.fn(),
  fingerprintForClientMock: vi.fn(),
  reserveCampaignMessageMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { transaction: transactionMock } }));
vi.mock("../whatsapp-campaign-audience.service", () => ({
  resolveCampaignAudience: resolveCampaignAudienceMock,
}));
vi.mock("../whatsapp-campaign-dedupe.service", () => ({
  buildCampaignContentSnapshot: buildCampaignContentSnapshotMock,
  fingerprintForClient: fingerprintForClientMock,
  reserveCampaignMessage: reserveCampaignMessageMock,
}));
vi.mock("../whatsapp-templates.service", () => ({
  ensureLocalTemplateForMeta: vi.fn(),
}));
vi.mock("../whatsapp-errors", () => ({
  waError: (code: string, options?: { details?: Record<string, unknown> }) =>
    Object.assign(new Error(code), { code, details: options?.details }),
}));

import { createAtomicWhatsappCampaign } from "../whatsapp-campaign-creation.service";

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

function makeTx(statusCounts: Array<{ status: string; count: number }>) {
  const campaign = {
    id: CAMPAIGN_ID,
    name: "Campanha atômica",
    description: null,
    type: "humano" as const,
    waEnabled: true,
    waTemplateId: "tpl-1",
    waBotId: null,
    waChannelId: 1,
    metaTemplateBodyParams: null,
    metaTemplateHeaderParams: null,
    metaTemplateHeaderMediaStorageKey: null,
    metaTemplateHeaderMediaType: null,
    createdBy: "u1",
    startDate: null,
    endDate: null,
    elevenLabsAgentId: null,
    elevenLabsVoiceId: null,
    umblerEnabled: false,
    umblerChannelId: null,
    umblerBotId: null,
    umblerBotTriggerName: null,
    umblerMessageText: null,
    umblerTriggerDecision: null,
    waTriggerDecision: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const insertedTables: unknown[] = [];
  const campaignValuesMock = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([campaign]) });
  const headerValuesMock = vi.fn().mockResolvedValue(undefined);
  const messageValuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) });
  const insert = vi.fn((table: unknown) => {
    insertedTables.push(table);
    if (table === campaigns) return { values: campaignValuesMock };
    if (table === whatsappCampaigns) return { values: headerValuesMock };
    if (table === whatsappCampaignMessages) return { values: messageValuesMock };
    if (table === whatsappCampaignImpacts) throw new Error("impact deve ser criado pelo helper de reserva");
    throw new Error("tabela inesperada");
  });
  const select = vi.fn().mockReturnValue({
    from: () => ({
      where: () => ({ groupBy: vi.fn().mockResolvedValue(statusCounts) }),
    }),
  });
  const updateWhereMock = vi.fn().mockResolvedValue(undefined);
  const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
  const update = vi.fn().mockReturnValue({ set: updateSetMock });
  return {
    tx: { insert, select, update },
    insertedTables,
    updateSetMock,
    messageValuesMock,
    headerValuesMock,
  };
}

const baseInput = {
  name: "Campanha atômica",
  waTemplateId: "tpl-1",
  waChannelId: 1,
  audience: { mode: "explicit" as const, clientIds: [CLIENT_ID] },
  dedupeWindowHours: 24,
  createdBy: "u1",
};

describe("createAtomicWhatsappCampaign", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    resolveCampaignAudienceMock.mockReset().mockResolvedValue([
      { id: CLIENT_ID, name: "Cliente", phone: "22999999999", whatsappOptOut: false },
    ]);
    buildCampaignContentSnapshotMock.mockReset().mockResolvedValue("snapshot");
    fingerprintForClientMock.mockReset().mockReturnValue("fingerprint");
    reserveCampaignMessageMock.mockReset().mockResolvedValue({
      queued: true,
      alreadyExisted: false,
      conflict: null,
    });
  });

  it("usa um único tx para criar cabeçalho, reservar mensagens e fechar contadores", async () => {
    const { tx, insertedTables, updateSetMock } = makeTx([{ status: "scheduled", count: 1 }]);
    transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => callback(tx));

    const result = await createAtomicWhatsappCampaign(baseInput);

    expect(result).toMatchObject({ campaignId: CAMPAIGN_ID, status: "in_progress", queued: 1 });
    expect(insertedTables).toEqual([campaigns, whatsappCampaigns]);
    expect(resolveCampaignAudienceMock).toHaveBeenCalledWith(tx, baseInput.audience);
    expect(buildCampaignContentSnapshotMock).toHaveBeenCalledWith(tx, expect.objectContaining({ id: CAMPAIGN_ID }));
    expect(reserveCampaignMessageMock).toHaveBeenCalledWith(tx, expect.objectContaining({ campaignId: CAMPAIGN_ID }));
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({
      totalContacts: 1,
      scheduledMessages: 1,
      status: "in_progress",
    }));
  });

  it("lança CAMPAIGN_ALL_DUPLICATE dentro do callback para o transaction fazer rollback", async () => {
    const { tx } = makeTx([{ status: "suppressed", count: 1 }]);
    reserveCampaignMessageMock.mockResolvedValue({
      queued: false,
      alreadyExisted: false,
      conflict: {
        campaignId: "old",
        campaignMessageId: "old-message",
        scheduledFor: new Date("2026-08-16T12:00:00Z"),
        phoneMasked: "********0000",
      },
    });
    let thrownInsideTransaction: unknown;
    transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => {
      try {
        return await callback(tx);
      } catch (error) {
        thrownInsideTransaction = error;
        throw error;
      }
    });

    await expect(createAtomicWhatsappCampaign(baseInput)).rejects.toMatchObject({
      code: "CAMPAIGN_ALL_DUPLICATE",
    });
    expect(thrownInsideTransaction).toMatchObject({ code: "CAMPAIGN_ALL_DUPLICATE" });
  });

  it("adquire reservas em ordem determinística de telefone para evitar deadlock concorrente", async () => {
    resolveCampaignAudienceMock.mockResolvedValue([
      { id: "client-22", name: "Cliente 22", phone: "22999999999", whatsappOptOut: false },
      { id: "client-21", name: "Cliente 21", phone: "21999999999", whatsappOptOut: false },
    ]);
    const { tx } = makeTx([{ status: "scheduled", count: 2 }]);
    transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => callback(tx));

    await createAtomicWhatsappCampaign(baseInput);

    expect(reserveCampaignMessageMock.mock.calls.map((call) => call[1].phoneNormalized)).toEqual([
      "+5521999999999",
      "+5522999999999",
    ]);
  });

  it("preserva agendamento futuro e deixa a campanha em created", async () => {
    const { tx, headerValuesMock } = makeTx([{ status: "scheduled", count: 1 }]);
    transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => callback(tx));

    const result = await createAtomicWhatsappCampaign({
      ...baseInput,
      scheduledAt: "2099-01-02T12:00:00.000Z",
    });

    expect(result).toMatchObject({ status: "created", scheduledAt: "2099-01-02T12:00:00.000Z" });
    expect(headerValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "created", startDate: new Date("2099-01-02T12:00:00.000Z") }),
    );
  });

  it("persiste supressões locais junto com pelo menos um destinatário válido", async () => {
    resolveCampaignAudienceMock.mockResolvedValue([
      { id: "opt-out", name: "Opt-out", phone: "21911111111", whatsappOptOut: true },
      { id: "invalid", name: "Inválido", phone: "123", whatsappOptOut: false },
      { id: CLIENT_ID, name: "Cliente", phone: "22999999999", whatsappOptOut: false },
    ]);
    const { tx, messageValuesMock } = makeTx([
      { status: "scheduled", count: 1 },
      { status: "suppressed", count: 2 },
    ]);
    transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => callback(tx));

    const result = await createAtomicWhatsappCampaign(baseInput);

    expect(result).toMatchObject({ queued: 1, skippedOptedOut: 1, skippedNoPhone: 1 });
    expect(messageValuesMock).toHaveBeenCalledWith([
      expect.objectContaining({ contactId: "opt-out", status: "suppressed" }),
      expect.objectContaining({ contactId: "invalid", status: "suppressed" }),
    ]);
  });
});
