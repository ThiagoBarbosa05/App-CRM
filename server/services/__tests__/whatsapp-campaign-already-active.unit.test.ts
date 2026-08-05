import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  campaigns,
  whatsappCampaigns,
  whatsappCampaignMessages,
  whatsappBots,
  whatsappChannels,
} from "@shared/schema";

// executeCampaign é exercido com um `db` inteiramente mockado — sem banco
// real. O objetivo deste teste é a Task 9 (Bug I): quando startBotSession
// retorna status "already_active" (sessão de bot já ativa pro contato — uma
// condição de corrida transitória), a mensagem deve ser reagendada com
// backoff (mesmo padrão de handleSendFailure), não falhar de imediato. Já
// "no_start_node" (erro real de configuração do bot) continua falhando na
// hora, sem retry.
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
  // Nunca suprime — o objetivo aqui é testar o branch already_active/no_start_node.
  validateCampaignRecipient: vi.fn(async () => null),
}));
vi.mock("../whatsapp-settings.service", () => ({
  // delay 0 evita esperar de verdade no teste (setTimeout real).
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
import { releaseImpact } from "../whatsapp-campaign-dedupe.service";

const releaseImpactMock = vi.mocked(releaseImpact);

function makeQueryResult<T>(rows: T[]): Promise<T[]> & { limit: (n: number) => Promise<T[]> } {
  const p = Promise.resolve(rows) as Promise<T[]> & { limit: (n: number) => Promise<T[]> };
  p.limit = () => Promise.resolve(rows);
  return p;
}

/** Captura o objeto passado a `.set(...)` na próxima chamada de `db.update(...)`. */
function captureUpdates(): Record<string, unknown>[] {
  const captured: Record<string, unknown>[] = [];
  updateMock.mockImplementation(() => ({
    set: (patch: Record<string, unknown>) => {
      captured.push(patch);
      return { where: () => Promise.resolve() };
    },
  }));
  return captured;
}

function setupSelectMock(msgAttempts: number) {
  selectMock.mockImplementation((cols?: Record<string, unknown>) => ({
    from: (table: unknown) => ({
      where: () => {
        if (table === whatsappCampaigns) {
          const isStatusOnlySelect =
            !!cols && Object.keys(cols).length === 1 && "status" in cols;
          if (isStatusOnlySelect) {
            // isCampaignHalted: campanha segue in_progress durante todo o batch.
            return makeQueryResult([{ status: "in_progress" }]);
          }
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
              waChannelId: 1,
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
              attempts: msgAttempts,
            },
          ]);
        }
        if (table === whatsappBots) {
          return makeQueryResult([{ id: "bot-1", deletedAt: null }]);
        }
        if (table === whatsappChannels) {
          return {
            limit: () =>
              makeQueryResult([{ id: 1, connectionStatus: "connected" }]),
          };
        }
        return makeQueryResult([]);
      },
    }),
  }));
}

describe("executeCampaign — bot session já ativa (already_active) vira retry com backoff", () => {
  let captured: Record<string, unknown>[];

  beforeEach(() => {
    startBotSessionMock.mockReset();
    releaseImpactMock.mockReset();
    releaseImpactMock.mockResolvedValue(undefined);
    updateMock.mockReset();
    captured = captureUpdates();
  });

  it("attempts=0 (abaixo do limite): reagenda como scheduled, incrementa attempts, define nextAttemptAt futuro, NÃO libera impact, e conta como retried", async () => {
    setupSelectMock(0);
    startBotSessionMock.mockResolvedValue({ status: "already_active" });

    const before = Date.now();
    const result = await executeCampaign("camp-1", { limit: 25 });

    expect(result.retried).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.sent).toBe(0);

    expect(captured).toHaveLength(1);
    const patch = captured[0];
    expect(patch.status).toBe("scheduled");
    expect(patch.attempts).toBe(1);
    expect(patch.nextAttemptAt).toBeInstanceOf(Date);
    expect((patch.nextAttemptAt as Date).getTime()).toBeGreaterThan(before);
    expect(typeof patch.errorMessage).toBe("string");
    expect(patch.errorMessage as string).toContain("1/5");

    expect(releaseImpactMock).not.toHaveBeenCalled();
  });

  it("attempts=4 (próxima tentativa bateria o teto de 5): falha em definitivo e libera impact", async () => {
    setupSelectMock(4);
    startBotSessionMock.mockResolvedValue({ status: "already_active" });

    const result = await executeCampaign("camp-1", { limit: 25 });

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);

    expect(captured).toHaveLength(1);
    const patch = captured[0];
    expect(patch.status).toBe("failed");
    expect(patch.attempts).toBe(5);
    expect(typeof patch.errorMessage).toBe("string");
    expect(patch.errorMessage as string).toMatch(/5 tentativas/);

    expect(releaseImpactMock).toHaveBeenCalledTimes(1);
    expect(releaseImpactMock).toHaveBeenCalledWith("msg-1");
  });

  it("no_start_node: comportamento inalterado — falha imediata, sem retry, libera impact", async () => {
    setupSelectMock(0);
    startBotSessionMock.mockResolvedValue({ status: "no_start_node" });

    const result = await executeCampaign("camp-1", { limit: 25 });

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);

    expect(captured).toHaveLength(1);
    const patch = captured[0];
    expect(patch.status).toBe("failed");
    expect(patch.errorMessage).toBe("Bot não possui nó inicial configurado");

    expect(releaseImpactMock).toHaveBeenCalledTimes(1);
    expect(releaseImpactMock).toHaveBeenCalledWith("msg-1");
  });
});
