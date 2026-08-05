import { describe, expect, it, vi, beforeEach } from "vitest";
import { whatsappCampaigns, whatsappCampaignImpacts, whatsappCampaignMessages } from "@shared/schema";

// requeueFailedMessages roda inteiro dentro de db.transaction(async (tx) =>
// {...}). Mockamos db.transaction para chamar o callback com um `tx` falso
// controlado por nós (update/select encadeados), no mesmo padrão de
// whatsapp-campaign-dedupe.unit.test.ts. drizzle-orm é parcialmente mockado
// (importOriginal + spy) só para poder inspecionar com quais argumentos
// `inArray`/`eq` foram chamados — é como confirmamos que o UPDATE de impacts
// filtra por campaign_message_id IN (ids reenfileirados) AND status='released',
// sem decodificar a árvore SQL manualmente.
const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { transaction: transactionMock } }));

const { findConflictMock } = vi.hoisted(() => ({
  findConflictMock: vi.fn(),
}));

vi.mock("../whatsapp-campaign-dedupe.service", () => ({
  buildCampaignContentSnapshot: vi.fn(),
  applyCampaignTag: vi.fn(),
  markImpactSent: vi.fn(),
  releaseImpact: vi.fn(),
  findConflict: findConflictMock,
  reserveCampaignMessage: vi.fn(),
}));

// Dependências não usadas por requeueFailedMessages, mas puxadas no topo de
// whatsapp-campaign.service.ts — mockadas só para o import não explodir.
vi.mock("../whatsapp-bot-engine.service", () => ({
  startBotSession: vi.fn(),
  buildClientVariables: () => ({}),
  interpolate: (text: string) => text,
}));
vi.mock("../whatsapp-conversations.service", () => ({
  findOrCreateConversation: vi.fn(),
}));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelByPhoneNumberId: vi.fn(),
  resolveChannelById: vi.fn(),
}));
vi.mock("../whatsapp-campaign-audience.service", () => ({
  validateCampaignRecipient: vi.fn(),
}));
vi.mock("../whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: vi.fn(async () => ({})),
}));
vi.mock("../../integrations/whatsapp", () => ({
  sendTemplateMessage: vi.fn(),
  WhatsAppApiError: class WhatsAppApiError extends Error {},
}));
vi.mock("../../lib/r2", () => ({
  getPublicR2Url: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    inArray: vi.fn(actual.inArray),
    eq: vi.fn(actual.eq),
  };
});

import { inArray, eq } from "drizzle-orm";
import { requeueFailedMessages } from "../whatsapp-campaign.service";
import { CampaignRequeueBlockedError } from "../whatsapp-campaign-errors";

type TxStub = {
  update: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

function makeTx(opts: {
  messageReturningRows: Array<{ id: string }>;
  campaignStatus: string | null;
}) {
  const updateCalls: unknown[] = [];

  const messageReturningMock = vi.fn().mockResolvedValue(opts.messageReturningRows);
  const messageWhereMock = vi.fn().mockReturnValue({ returning: messageReturningMock });
  const messageSetMock = vi.fn().mockReturnValue({ where: messageWhereMock });

  const impactWhereMock = vi.fn().mockResolvedValue(undefined);
  const impactSetMock = vi.fn().mockReturnValue({ where: impactWhereMock });

  const campaignUpdateWhereMock = vi.fn().mockResolvedValue(undefined);
  const campaignSetMock = vi.fn().mockReturnValue({ where: campaignUpdateWhereMock });

  const updateMock = vi.fn((table: unknown) => {
    updateCalls.push(table);
    if (table === whatsappCampaignMessages) return { set: messageSetMock };
    if (table === whatsappCampaignImpacts) return { set: impactSetMock };
    if (table === whatsappCampaigns) return { set: campaignSetMock };
    throw new Error(`update inesperado em tabela desconhecida: ${String(table)}`);
  });

  const selectWhereMock = vi
    .fn()
    .mockResolvedValue(opts.campaignStatus === null ? [] : [{ status: opts.campaignStatus }]);
  const selectMock = vi.fn().mockReturnValue({ from: () => ({ where: selectWhereMock }) });

  return {
    tx: { update: updateMock, select: selectMock } as TxStub,
    updateCalls,
    messageSetMock,
    messageWhereMock,
    impactSetMock,
    impactWhereMock,
    campaignSetMock,
    campaignUpdateWhereMock,
    selectMock,
    selectWhereMock,
  };
}

describe("requeueFailedMessages", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    findConflictMock.mockReset();
    vi.mocked(inArray).mockClear();
    vi.mocked(eq).mockClear();
  });

  it("reseta status/errorMessage/attempts/nextAttemptAt nas mensagens failed e restaura os impacts released→reserved", async () => {
    const { tx, messageSetMock, impactSetMock, campaignSetMock, updateCalls } = makeTx({
      messageReturningRows: [{ id: "msg-1" }, { id: "msg-2" }],
      campaignStatus: "completed",
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    const result = await requeueFailedMessages("camp-1");

    expect(result).toEqual({ requeued: 2 });

    expect(messageSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "scheduled",
        errorMessage: null,
        attempts: 0,
        nextAttemptAt: null,
      }),
    );

    expect(impactSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reserved", sentAt: null }),
    );
    // inArray filtra exatamente pelos ids retornados pelo UPDATE de mensagens.
    expect(vi.mocked(inArray)).toHaveBeenCalledWith(
      whatsappCampaignImpacts.campaignMessageId,
      ["msg-1", "msg-2"],
    );
    // e o UPDATE de impacts só pega quem estava released (não sent/cancelled).
    expect(
      vi.mocked(eq).mock.calls.some(
        (call) => call[0] === whatsappCampaignImpacts.status && call[1] === "released",
      ),
    ).toBe(true);

    // Campanha completed está na lista permitida → revive para in_progress.
    expect(campaignSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress", completedAt: null }),
    );

    // Ordem: mensagens → impacts → (select embutido) → campanha.
    expect(updateCalls).toEqual([
      whatsappCampaignMessages,
      whatsappCampaignImpacts,
      whatsappCampaigns,
    ]);
  });

  it("não chama findConflict no fluxo de retry — restaurar reserva é incondicional para os ids reenfileirados", async () => {
    const { tx } = makeTx({
      messageReturningRows: [{ id: "msg-1" }],
      campaignStatus: "failed",
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    await requeueFailedMessages("camp-1");

    expect(findConflictMock).not.toHaveBeenCalled();
  });

  it("campanha cancelled: lança CampaignRequeueBlockedError e NÃO chega a fazer o UPDATE de status da campanha", async () => {
    const { tx, campaignSetMock, updateCalls } = makeTx({
      messageReturningRows: [{ id: "msg-1" }],
      campaignStatus: "cancelled",
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    await expect(requeueFailedMessages("camp-1")).rejects.toThrow(CampaignRequeueBlockedError);
    await expect(requeueFailedMessages("camp-1")).rejects.toThrow(
      "Campanha cancelada não pode ser reprocessada.",
    );

    // O UPDATE de mensagens/impacts aconteceu dentro da transação (linhas
    // acima do throw), mas o UPDATE final de whatsapp_campaigns nunca é
    // chamado — e como tudo roda dentro de db.transaction, um throw aqui
    // dispara ROLLBACK real no Postgres, desfazendo os UPDATEs anteriores.
    // Esse rollback físico não é observável neste mock (sem banco real); o
    // que garantimos aqui é que o código nunca tenta persistir o novo status
    // da campanha quando bloqueado.
    expect(campaignSetMock).not.toHaveBeenCalled();
    expect(updateCalls).not.toContain(whatsappCampaigns);
  });

  it("status não listado (paused) também bloqueia com mensagem genérica", async () => {
    const { tx } = makeTx({
      messageReturningRows: [{ id: "msg-1" }],
      campaignStatus: "paused",
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    await expect(requeueFailedMessages("camp-1")).rejects.toThrow(
      "Campanha no estado atual (paused) não pode ser reprocessada.",
    );
  });

  it("status não listado (created) também bloqueia com mensagem genérica", async () => {
    const { tx } = makeTx({
      messageReturningRows: [{ id: "msg-1" }],
      campaignStatus: "created",
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    await expect(requeueFailedMessages("camp-1")).rejects.toThrow(
      "Campanha no estado atual (created) não pode ser reprocessada.",
    );
  });

  it("zero mensagens failed: { requeued: 0 }, sem UPDATE de impacts, sem SELECT de status e sem tentativa de mudar status da campanha", async () => {
    const { tx, impactSetMock, campaignSetMock, updateCalls, selectMock } = makeTx({
      messageReturningRows: [],
      campaignStatus: "cancelled", // mesmo campanha bloqueada, não deveria importar aqui
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    const result = await requeueFailedMessages("camp-1");

    expect(result).toEqual({ requeued: 0 });
    expect(impactSetMock).not.toHaveBeenCalled();
    expect(campaignSetMock).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([whatsappCampaignMessages]);
    // Early return acontece antes do SELECT de status — zero failed não deve
    // nem consultar whatsapp_campaigns.
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("campanha não encontrada (SELECT retorna vazio): lança CampaignRequeueBlockedError e não atualiza status da campanha", async () => {
    const { tx, campaignSetMock, updateCalls } = makeTx({
      messageReturningRows: [{ id: "msg-1" }],
      campaignStatus: null,
    });
    transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

    await expect(requeueFailedMessages("camp-inexistente")).rejects.toThrow(
      CampaignRequeueBlockedError,
    );
    await expect(requeueFailedMessages("camp-inexistente")).rejects.toThrow(
      "Campanha camp-inexistente não encontrada.",
    );

    expect(campaignSetMock).not.toHaveBeenCalled();
    expect(updateCalls).not.toContain(whatsappCampaigns);
  });

  it("in_progress e failed também estão na lista de status permitidos para revigorar a campanha", async () => {
    for (const status of ["in_progress", "failed"]) {
      const { tx, campaignSetMock } = makeTx({
        messageReturningRows: [{ id: "msg-1" }],
        campaignStatus: status,
      });
      transactionMock.mockImplementation(async (fn: (tx: TxStub) => unknown) => fn(tx));

      const result = await requeueFailedMessages("camp-1");

      expect(result).toEqual({ requeued: 1 });
      expect(campaignSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "in_progress" }),
      );
    }
  });
});
