import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  whatsappCampaignImpacts,
  whatsappCampaignMessages,
  whatsappCampaigns,
} from "@shared/schema";

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}));

vi.mock("../../db", () => ({
  db: { transaction: transactionMock },
}));

vi.mock("../../integrations/whatsapp", () => ({
  WhatsAppApiError: class WhatsAppApiError extends Error {
    status = 500;
  },
}));

vi.mock("../../integrations/baileys-gateway", () => ({
  BaileysGatewayError: class BaileysGatewayError extends Error {
    code = "unexpected";
  },
}));

import { transitionWhatsappCampaign } from "../whatsapp-campaign-lifecycle.service";

type CampaignStatus = "created" | "in_progress" | "paused" | "completed" | "failed" | "cancelled";

function makeTransaction(currentStatus?: CampaignStatus, startDate: Date | null = null) {
  const returningByTable = new Map<unknown, unknown[]>([
    [whatsappCampaigns, [{ id: "campaign-1" }]],
    [whatsappCampaignMessages, [{ id: "message-1" }, { id: "message-2" }]],
    [whatsappCampaignImpacts, [{ id: "impact-1" }, { id: "impact-2" }]],
  ]);
  const writes: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn().mockResolvedValue(
            currentStatus ? [{ id: "campaign-1", status: currentStatus, startDate }] : [],
          ),
        })),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        writes.push({ table, values });
        return {
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue(returningByTable.get(table) ?? []),
          })),
        };
      }),
    })),
  };

  transactionMock.mockImplementation(async (callback: (executor: typeof tx) => unknown) => callback(tx));
  return { tx, writes };
}

describe("transitionWhatsappCampaign", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("falha com CAMPAIGN_NOT_FOUND sem executar updates quando o id não existe", async () => {
    const { tx } = makeTransaction();

    await expect(transitionWhatsappCampaign("campaign-1", "pause")).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
      httpStatus: 404,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rejeita uma transição inválida sem alterar uma campanha terminal", async () => {
    const { tx } = makeTransaction("completed");

    await expect(transitionWhatsappCampaign("campaign-1", "pause")).rejects.toMatchObject({
      code: "CAMPAIGN_INVALID_TRANSITION",
      httpStatus: 409,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("pausa uma campanha em andamento e confirma a linha alterada", async () => {
    const { writes } = makeTransaction("in_progress");

    const result = await transitionWhatsappCampaign("campaign-1", "pause");

    expect(result).toEqual({ campaignId: "campaign-1", status: "paused" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: whatsappCampaigns, values: { status: "paused" } });
  });

  it("retoma como created quando o agendamento original ainda está no futuro", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    const { writes } = makeTransaction("paused", new Date("2026-08-23T13:00:00.000Z"));

    const result = await transitionWhatsappCampaign("campaign-1", "resume");

    expect(result).toEqual({ campaignId: "campaign-1", status: "created" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: whatsappCampaigns, values: { status: "created" } });
  });

  it.each([
    new Date("2026-08-23T12:00:00.000Z"),
    new Date("2026-08-23T11:59:59.999Z"),
  ])("retoma como in_progress quando o agendamento já venceu (%s)", async (startDate) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    const { writes } = makeTransaction("paused", startDate);

    const result = await transitionWhatsappCampaign("campaign-1", "resume");

    expect(result).toEqual({ campaignId: "campaign-1", status: "in_progress" });
    expect(writes[0]).toMatchObject({ table: whatsappCampaigns, values: { status: "in_progress" } });
  });

  it("cancela campanha, mensagens agendadas e impacts na mesma transação", async () => {
    const { writes } = makeTransaction("paused");

    const result = await transitionWhatsappCampaign("campaign-1", "cancel");

    expect(result).toEqual({
      campaignId: "campaign-1",
      status: "cancelled",
      cancelledMessages: 2,
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(writes.map(({ table }) => table)).toEqual([
      whatsappCampaignMessages,
      whatsappCampaignImpacts,
      whatsappCampaigns,
    ]);
  });
});
