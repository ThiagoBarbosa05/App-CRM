import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  campaigns,
  whatsappCampaigns,
  whatsappCampaignMessages,
  whatsappBots,
  whatsappChannels,
} from "@shared/schema";

// executeCampaign com `db` inteiramente mockado — sem banco real. O foco aqui é
// só o contrato de chamada do bot: a campanha precisa entregar o destinatário
// (`whatsapp_campaign_messages.contact_id`) ao engine, senão as variáveis de
// personalização são resolvidas apenas pela conversa existente e nascem vazias
// no primeiro disparo para um contato sem histórico — caso normal de audiência
// importada por planilha.
const { selectMock, updateMock, startBotSessionMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  startBotSessionMock: vi.fn(),
}));

vi.mock("../../db", () => ({ db: { select: selectMock, update: updateMock } }));

vi.mock("../whatsapp-bot-engine.service", () => ({
  startBotSession: startBotSessionMock,
  buildClientVariables: () => ({}),
  interpolate: (text: string) => text,
}));
vi.mock("../whatsapp-conversations.service", () => ({
  findOrCreateConversation: vi.fn(),
}));
vi.mock("../whatsapp-channels.service", () => ({
  getChannelByPhoneNumberId: vi.fn(),
  resolveChannelById: vi.fn(async () => ({
    id: 1,
    provider: "cloud_api",
    phoneNumberId: "phone-id-1",
    accessToken: "token-1",
  })),
}));
vi.mock("../whatsapp-campaign-dedupe.service", () => ({
  applyCampaignTag: vi.fn(async () => {}),
  markImpactSent: vi.fn(async () => {}),
  releaseImpact: vi.fn(async () => {}),
}));
vi.mock("../whatsapp-campaign-audience.service", () => ({
  validateCampaignRecipient: vi.fn(async () => null),
}));
vi.mock("../whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: vi.fn(async () => ({ wa_message_delay_ms: "0" })),
}));
vi.mock("../../integrations/whatsapp", () => ({
  sendTemplateMessage: vi.fn(),
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

function setupSelectMock(contactId: string | null) {
  selectMock.mockImplementation((cols?: Record<string, unknown>) => ({
    from: (table: unknown) => ({
      where: () => {
        if (table === whatsappCampaigns) {
          const isStatusOnlySelect =
            !!cols && Object.keys(cols).length === 1 && "status" in cols;
          if (isStatusOnlySelect) return makeQueryResult([{ status: "in_progress" }]);
          return makeQueryResult([{ postSendWhatsappTagId: null, audienceSelector: null }]);
        }
        if (table === campaigns) {
          return makeQueryResult([
            {
              id: "camp-1",
              waEnabled: true,
              waBotId: "bot-1",
              waTemplateId: null,
              waChannelId: 1,
            },
          ]);
        }
        if (table === whatsappCampaignMessages) {
          return makeQueryResult([
            {
              id: "msg-1",
              campaignId: "camp-1",
              contactId,
              contactName: "Fulano",
              phoneNumber: "+5511999990001",
              phoneNormalized: "+5511999990001",
              status: "scheduled",
              attempts: 0,
            },
          ]);
        }
        if (table === whatsappBots) {
          return makeQueryResult([{ id: "bot-1", deletedAt: null }]);
        }
        if (table === whatsappChannels) {
          return { limit: () => makeQueryResult([{ id: 1, connectionStatus: "connected" }]) };
        }
        return makeQueryResult([]);
      },
    }),
  }));
}

describe("executeCampaign — campanha de bot entrega o contato ao engine", () => {
  beforeEach(() => {
    startBotSessionMock.mockReset();
    // Encerra no branch de falha mais simples: o que importa é o argumento.
    startBotSessionMock.mockResolvedValue({ status: "no_start_node" });
    updateMock.mockReset();
    updateMock.mockImplementation(() => ({
      set: () => ({ where: () => Promise.resolve() }),
    }));
  });

  it("passa o contactId do destinatário como clientId no contexto do disparo", async () => {
    setupSelectMock("client-1");

    await executeCampaign("camp-1", { limit: 25 });

    expect(startBotSessionMock).toHaveBeenCalledTimes(1);
    const context = startBotSessionMock.mock.calls[0][6];
    expect(context).toMatchObject({
      source: "campaign",
      campaignId: "camp-1",
      channelId: 1,
      clientId: "client-1",
    });
  });

  it("passa clientId null quando o destinatário não tem contactId (engine cai no fallback pela conversa)", async () => {
    setupSelectMock(null);

    await executeCampaign("camp-1", { limit: 25 });

    expect(startBotSessionMock).toHaveBeenCalledTimes(1);
    expect(startBotSessionMock.mock.calls[0][6]).toMatchObject({ clientId: null });
  });
});
