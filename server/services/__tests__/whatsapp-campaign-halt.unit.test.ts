import { describe, expect, it, vi, beforeEach } from "vitest";
import { campaigns, whatsappCampaigns, whatsappCampaignMessages, whatsappBots } from "@shared/schema";

// executeCampaign é exercido com um `db` inteiramente mockado — sem banco
// real. O objetivo deste teste é só a lógica de "halt": se a campanha sair de
// "in_progress" (pause/cancel) entre uma mensagem e outra do batch, o loop
// deve parar (break) e retornar halted: true, sem processar o resto.
const { selectMock, updateMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { select: selectMock, update: updateMock } }));

// Dependências externas ao envio — mockadas para isolar a lógica de halt do
// resto do fluxo (envio real de bot, persistência de conversa, etc.), como no
// padrão de whatsapp-baileys-events.unit.test.ts.
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
vi.mock("../whatsapp-campaign-dedupe.service", () => ({
  applyCampaignTag: vi.fn(async () => {}),
  markImpactSent: vi.fn(async () => {}),
  releaseImpact: vi.fn(async () => {}),
}));
vi.mock("../whatsapp-campaign-audience.service", () => ({
  // Nunca suprime — o objetivo aqui é testar o halt, não a supressão.
  validateCampaignRecipient: vi.fn(async () => null),
}));
vi.mock("../whatsapp-settings.service", () => ({
  // delay 0 evita esperar de verdade no teste (setTimeout real).
  getWhatsappSettingsRaw: vi.fn(async () => ({ wa_message_delay_ms: "0" })),
}));
vi.mock("../../integrations/whatsapp", () => ({
  sendTemplateMessage: vi.fn(),
  // Usado por classifySendError (whatsapp-campaign-retry.ts) no `instanceof`.
  WhatsAppApiError: class WhatsAppApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("../../lib/r2", () => ({
  getPublicR2Url: vi.fn(),
}));

import { executeCampaign } from "../whatsapp-campaign.service";

function makeQueryResult<T>(rows: T[]): Promise<T[]> & { limit: (n: number) => Promise<T[]> } {
  const p = Promise.resolve(rows) as Promise<T[]> & { limit: (n: number) => Promise<T[]> };
  p.limit = () => Promise.resolve(rows);
  return p;
}

describe("executeCampaign — para no meio do batch quando a campanha é pausada/cancelada", () => {
  let haltedCallCount: number;

  beforeEach(() => {
    haltedCallCount = 0;
    updateMock.mockReset();
    updateMock.mockReturnValue({
      set: () => ({ where: () => Promise.resolve() }),
    });

    selectMock.mockReset();
    selectMock.mockImplementation((cols?: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === whatsappCampaigns) {
            const isStatusOnlySelect =
              !!cols && Object.keys(cols).length === 1 && "status" in cols;
            if (isStatusOnlySelect) {
              // isCampaignHalted: primeira chamada "in_progress" (segue),
              // segunda chamada "paused" (operador pausou no meio do batch).
              const status = haltedCallCount === 0 ? "in_progress" : "paused";
              haltedCallCount++;
              return makeQueryResult([{ status }]);
            }
            // campaignLog (postSendWhatsappTagId / audienceSelector)
            return makeQueryResult([
              { postSendWhatsappTagId: null, audienceSelector: null },
            ]);
          }
          if (table === campaigns) {
            return makeQueryResult([
              {
                id: "camp-1",
                waEnabled: true,
                waBotId: "bot-1",
                waTemplateId: null,
                waChannelId: null,
              },
            ]);
          }
          if (table === whatsappCampaignMessages) {
            return makeQueryResult([
              {
                id: "msg-1",
                campaignId: "camp-1",
                contactId: "client-1",
                contactName: "Fulano",
                phoneNumber: "+5511999990001",
                phoneNormalized: "+5511999990001",
                status: "scheduled",
                attempts: 0,
              },
              {
                id: "msg-2",
                campaignId: "camp-1",
                contactId: "client-2",
                contactName: "Ciclano",
                phoneNumber: "+5511999990002",
                phoneNormalized: "+5511999990002",
                status: "scheduled",
                attempts: 0,
              },
            ]);
          }
          if (table === whatsappBots) {
            return makeQueryResult([{ id: "bot-1", deletedAt: null }]);
          }
          return makeQueryResult([]);
        },
      }),
    }));
  });

  it("break no loop de bot e retorna halted: true sem processar a 2ª mensagem", async () => {
    const result = await executeCampaign("camp-1", { limit: 25 });

    expect(result.halted).toBe(true);
    // A 1ª mensagem foi processada (falhou, pois waChannelId é null para o
    // bot nesse fixture — irrelevante para o teste, só prova que passou pelo
    // corpo do loop); a 2ª nunca chegou a ser tocada porque o halt-check
    // parou o loop antes dela.
    expect(result.sent + result.failed + result.skipped).toBe(1);
    // 2 chamadas ao isCampaignHalted: uma antes de cada mensagem até o break.
    expect(haltedCallCount).toBe(2);
  });
});
