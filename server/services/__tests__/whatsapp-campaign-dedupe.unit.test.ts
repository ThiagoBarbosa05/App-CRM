import { describe, expect, it, vi, beforeEach } from "vitest";
import { whatsappCampaignImpacts, whatsappCampaignMessages, type Client } from "@shared/schema";

// reserveCampaignMessage participa da transacao aberta pelo chamador. Aqui
// passamos um `tx` falso que a gente controla: select/limit (findConflict), execute (advisory
// lock) e insert(...).values(...).onConflictDoNothing() para as duas tabelas
// (mensagem e impact), com .returning() no insert da mensagem — é exatamente
// esse .returning() que a Task 4 introduziu, então o mock precisa simular
// tanto "linha inserida" quanto "onConflictDoNothing engoliu o insert"
// (array vazio) para cobrir os 3 casos do bug.
vi.mock("../../db", () => ({ db: {} }));

// selectCampaignEntryNode/buildClientVariables só são usados por
// buildCampaignContentSnapshot/fingerprintForClient, não por
// reserveCampaignMessage — mockados aqui só para que o import do módulo real
// (whatsapp-bot-engine.service, que importa "server/db" via alias e explode
// sem DATABASE_URL) nunca aconteça.
vi.mock("../whatsapp-bot-engine.service", () => ({
  buildClientVariables: vi.fn(() => ({})),
  selectCampaignEntryNode: vi.fn(() => null),
}));

import { reserveCampaignMessage, type CampaignDedupeConflict } from "../whatsapp-campaign-dedupe.service";

type TxStub = {
  execute: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function makeTx(options: {
  conflict: CampaignDedupeConflict | null;
  messageReturningRows: Array<{ id: string }>;
}): { tx: TxStub; impactValuesMock: ReturnType<typeof vi.fn> } {
  const executeMock = vi.fn().mockResolvedValue(undefined);

  const selectMock = vi.fn().mockReturnValue({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(options.conflict ? [options.conflict] : []),
      }),
    }),
  });

  const messageReturningMock = vi.fn().mockResolvedValue(options.messageReturningRows);
  const messageOnConflictDoNothingMock = vi.fn().mockReturnValue({ returning: messageReturningMock });
  const messageValuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: messageOnConflictDoNothingMock });

  const impactOnConflictDoNothingMock = vi.fn().mockResolvedValue(undefined);
  const impactValuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: impactOnConflictDoNothingMock });

  const insertMock = vi.fn((table: unknown) => {
    if (table === whatsappCampaignMessages) return { values: messageValuesMock };
    if (table === whatsappCampaignImpacts) return { values: impactValuesMock };
    throw new Error(`insert inesperado em tabela desconhecida: ${String(table)}`);
  });

  return {
    tx: { execute: executeMock, select: selectMock, insert: insertMock },
    impactValuesMock,
  };
}

const baseInput = {
  campaignId: "camp-1",
  client: { id: "client-1", name: "Fulano" } as Client,
  phoneNormalized: "+5511999990000",
  contentFingerprint: "fingerprint-abc",
  scheduledFor: new Date("2026-08-04T12:00:00Z"),
  windowHours: 24,
  postSendTagRequested: false,
};

describe("reserveCampaignMessage", () => {
  it("corrida no insert da mensagem (.returning() vazio, sem conflito de fingerprint): não insere impact, alreadyExisted true, queued false", async () => {
    const { tx, impactValuesMock } = makeTx({ conflict: null, messageReturningRows: [] });

    const result = await reserveCampaignMessage(tx, baseInput);

    expect(result).toEqual({ queued: false, alreadyExisted: true, conflict: null });
    expect(impactValuesMock).not.toHaveBeenCalled();
  });

  it("insert limpo (sem conflito de fingerprint, .returning() retorna a linha): cria impact, queued true, alreadyExisted false", async () => {
    const { tx, impactValuesMock } = makeTx({
      conflict: null,
      messageReturningRows: [{ id: "camp-1-client-1" }],
    });
    const result = await reserveCampaignMessage(tx, baseInput);

    expect(result).toEqual({ queued: true, alreadyExisted: false, conflict: null });
    expect(impactValuesMock).toHaveBeenCalledTimes(1);
    expect(impactValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-1",
        campaignMessageId: "camp-1-client-1",
        phoneNormalized: "+5511999990000",
      }),
    );
  });

  it("conflito de dedupe por fingerprint: mensagem suprimida, sem impact, queued false, alreadyExisted false, conflict preenchido", async () => {
    const conflict: CampaignDedupeConflict = {
      campaignId: "camp-0",
      campaignMessageId: "camp-0-client-1",
      scheduledFor: new Date("2026-08-03T12:00:00Z"),
      phoneMasked: "**********0000",
    };
    const { tx, impactValuesMock } = makeTx({
      conflict,
      // a linha da mensagem ainda é inserida (com status "suppressed") mesmo
      // havendo conflito de fingerprint — não há conflito de índice único
      // aqui, então .returning() traz a linha normalmente.
      messageReturningRows: [{ id: "camp-1-client-1" }],
    });
    const result = await reserveCampaignMessage(tx, baseInput);

    expect(result).toEqual({ queued: false, alreadyExisted: false, conflict });
    expect(impactValuesMock).not.toHaveBeenCalled();
  });
});
