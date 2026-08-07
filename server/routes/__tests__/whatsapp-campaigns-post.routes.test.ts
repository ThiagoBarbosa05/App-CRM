import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";

// server/db abre um Pool real na importação; whatsapp.routes.ts o puxa
// transitivamente por vários services/controllers importados no topo do
// arquivo. Mockamos db com uma fila de resultados de SELECT (na ordem em que
// o endpoint os dispara) e capturamos os argumentos de INSERT/UPDATE para
// verificar que nada além do SELECT de idempotência roda quando bloqueado.
type QueryResult = unknown[];

const {
  selectResults,
  insertValuesMock,
  insertOnConflictDoUpdateMock,
  insertOnConflictDoNothingMock,
  updateSetCalls,
} = vi.hoisted(() => ({
  selectResults: [] as QueryResult[],
  insertValuesMock: vi.fn(),
  insertOnConflictDoUpdateMock: vi.fn(),
  insertOnConflictDoNothingMock: vi.fn(),
  updateSetCalls: [] as unknown[],
}));

vi.mock("../../db", () => {
  function selectChain() {
    return {
      from: () => ({
        where: () => {
          const result = selectResults.shift() ?? [];
          return {
            // suportado tanto `await db.select()...where()` direto
            // (retorna array) quanto encadeado com `.limit()`/`.groupBy()`.
            then: (resolve: (value: unknown) => unknown) => resolve(result),
            limit: () => Promise.resolve(result),
            groupBy: () => Promise.resolve(result),
          };
        },
      }),
    };
  }

  const db = {
    select: vi.fn(selectChain),
    insert: vi.fn(() => ({
      values: insertValuesMock.mockImplementation((values: unknown) => {
        void values;
        return {
          onConflictDoUpdate: insertOnConflictDoUpdateMock.mockImplementation(async () => undefined),
          onConflictDoNothing: insertOnConflictDoNothingMock.mockImplementation(async () => undefined),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setArgs: unknown) => {
        updateSetCalls.push(setArgs);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };

  return { db };
});

const {
  resolveChannelByIdMock,
  listChannelIdsForUserMock,
  resolveCampaignAudienceMock,
  analyzeBotCompatibilityMock,
  buildCampaignContentSnapshotMock,
  fingerprintForClientMock,
  reserveCampaignMessageMock,
} = vi.hoisted(() => ({
  resolveChannelByIdMock: vi.fn(),
  listChannelIdsForUserMock: vi.fn(),
  resolveCampaignAudienceMock: vi.fn(),
  analyzeBotCompatibilityMock: vi.fn(),
  buildCampaignContentSnapshotMock: vi.fn(),
  fingerprintForClientMock: vi.fn(),
  reserveCampaignMessageMock: vi.fn(),
}));

vi.mock("../../controllers/campaigns/campaign-logger", () => ({
  listCampaigns: vi.fn(),
  getCampaignDetails: vi.fn(),
  getCampaignStats: vi.fn(),
  getCampaignBotStats: vi.fn(),
}));

vi.mock("../../controllers/whatsapp/bot-session-history.controller", () => ({
  listBotDispatchHistory: vi.fn(),
  parseBotSessionHistoryQuery: vi.fn(),
}));

vi.mock("../../services/whatsapp-campaign-dedupe.service", () => ({
  buildCampaignContentSnapshot: buildCampaignContentSnapshotMock,
  applyCampaignTag: vi.fn(),
  DEFAULT_DEDUPE_WINDOW_HOURS: 24,
  fingerprintForClient: fingerprintForClientMock,
  findConflict: vi.fn(),
  MAX_DEDUPE_WINDOW_HOURS: 24 * 365,
  reserveCampaignMessage: reserveCampaignMessageMock,
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  listChannelIdsForUser: listChannelIdsForUserMock,
  resolveChannelById: resolveChannelByIdMock,
}));

vi.mock("../../services/whatsapp-campaign-audience.service", () => ({
  resolveCampaignAudience: resolveCampaignAudienceMock,
}));

vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: analyzeBotCompatibilityMock,
  BotCompatibilityLookupError: class BotCompatibilityLookupError extends Error {
    statusCode = 502;
  },
}));

vi.mock("../../services/whatsapp-campaign.service", () => ({
  requeueFailedMessages: vi.fn(),
}));

vi.mock("../../integrations/whatsapp", () => ({
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
}));

import whatsappRouter from "../whatsapp.routes";

function makeApp() {
  return createRouteTestApp({
    router: whatsappRouter,
    basePath: "/api/whatsapp",
    middlewares: [createMockAuthMiddleware({ userId: "u1", role: "admin" })],
  });
}

const CAMPAIGN_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

const baseCampaignRow = {
  id: CAMPAIGN_ID,
  name: "Campanha teste",
  deletedAt: null,
  waEnabled: true,
  waTemplateId: "tpl-1",
  waBotId: null,
  waChannelId: "chan-1",
};

const baseChannelRow = { id: "chan-1", connectionStatus: "connected" };

function seedHappyPathSelects(opts: {
  existingWaCampaign: unknown[];
  statusCounts?: unknown[];
}) {
  selectResults.push([baseCampaignRow]); // 1. campaign
  selectResults.push([baseChannelRow]); // 2. channel
  selectResults.push(opts.existingWaCampaign); // 3. idempotency check
  selectResults.push([]); // 4. alreadyQueued
  selectResults.push(opts.statusCounts ?? [{ status: "scheduled", count: 1 }]); // 5. recount
}

describe("POST /campaigns", () => {
  beforeEach(() => {
    selectResults.length = 0;
    updateSetCalls.length = 0;
    insertValuesMock.mockClear();
    insertOnConflictDoUpdateMock.mockClear();
    insertOnConflictDoNothingMock.mockClear();

    resolveChannelByIdMock.mockReset().mockResolvedValue({ provider: "cloud_api" });
    listChannelIdsForUserMock.mockReset();
    resolveCampaignAudienceMock.mockReset().mockResolvedValue([
      { id: CLIENT_ID, name: "Cliente 1", phone: "22999999999", whatsappOptOut: false },
    ]);
    analyzeBotCompatibilityMock.mockReset();
    buildCampaignContentSnapshotMock.mockReset().mockResolvedValue("snapshot-1");
    fingerprintForClientMock.mockReset().mockReturnValue("fp-1");
    reserveCampaignMessageMock.mockReset().mockResolvedValue({ queued: true });
  });

  it("409 quando a campanha já está in_progress — sem nenhum INSERT/UPDATE além do SELECT de checagem", async () => {
    seedHappyPathSelects({ existingWaCampaign: [{ status: "in_progress" }] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "CAMPAIGN_ALREADY_RUNNING",
      campaignStatus: "in_progress",
    });
    // O hint é o que diz ao usuário o que fazer no lugar de disparar de novo.
    expect(res.body.hint).toMatch(/pausar|retomar|cancelar/i);
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetCalls).toHaveLength(0);
  });

  it("409 quando a campanha já está paused — sem nenhum INSERT/UPDATE", async () => {
    seedHappyPathSelects({ existingWaCampaign: [{ status: "paused" }] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(409);
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetCalls).toHaveLength(0);
  });

  it("409 quando a campanha já está cancelled — mensagem sugere retry-failed", async () => {
    seedHappyPathSelects({ existingWaCampaign: [{ status: "cancelled" }] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "CAMPAIGN_ALREADY_FINISHED",
      campaignStatus: "cancelled",
    });
    expect(res.body.hint).toMatch(/Reenviar falhas/i);
    expect(insertValuesMock).not.toHaveBeenCalled();
    expect(updateSetCalls).toHaveLength(0);
  });

  it("409 quando a campanha já está completed — mensagem sugere retry-failed", async () => {
    seedHappyPathSelects({ existingWaCampaign: [{ status: "completed" }] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: "CAMPAIGN_ALREADY_FINISHED",
      campaignStatus: "completed",
    });
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("segue o fluxo normal quando não existe linha em whatsappCampaigns ainda (primeira vez)", async () => {
    seedHappyPathSelects({ existingWaCampaign: [] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(202);
    expect(insertOnConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    // startDate é atualizado no upsert normalmente
    const upsertValues = insertValuesMock.mock.calls[0][0];
    expect(upsertValues.startDate).toBeInstanceOf(Date);
  });

  it("segue o fluxo normal quando a campanha existente está em status created (reagendamento)", async () => {
    seedHappyPathSelects({ existingWaCampaign: [{ status: "created" }] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(202);
    expect(insertOnConflictDoUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("totais do UPDATE final vêm do recount agrupado, não dos contadores locais desta submissão", async () => {
    // Semeia uma linha "suppressed" pré-existente (de outra submissão) que
    // não passa pelo loop desta chamada — os contadores locais (queued=1,
    // suppressedDuplicate=0, preSuppressed.length=0) não a enxergam, mas o
    // recount agrupado deve refletir todas as linhas reais da tabela.
    seedHappyPathSelects({
      existingWaCampaign: [],
      statusCounts: [
        { status: "scheduled", count: 1 },
        { status: "suppressed", count: 1 },
        { status: "sent", count: 2 },
        { status: "failed", count: 1 },
      ],
    });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(202);
    // último update() é o final (o primeiro é o de dedupeWindowHours/contentFingerprintSnapshot)
    const finalUpdate = updateSetCalls[updateSetCalls.length - 1] as Record<string, unknown>;
    expect(finalUpdate.totalContacts).toBe(5); // 1 + 1 + 2 + 1
    expect(finalUpdate.scheduledMessages).toBe(1);
    expect(finalUpdate.sentMessages).toBe(2);
    expect(finalUpdate.failedMessages).toBe(1);
    expect(finalUpdate.status).toBe("in_progress"); // scheduledMessages > 0, não isScheduled
  });

  it("skippedAlreadyQueued continua presente na resposta 202", async () => {
    seedHappyPathSelects({ existingWaCampaign: [] });

    const res = await request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("skippedAlreadyQueued");
  });
});

// Antes destes casos, o disparo respondia sempre com uma frase solta (ou, no
// catch-all, com o `message` cru da exceção). O contrato agora é `code` +
// `hint`, para a tela poder dizer o que fazer em vez de só "deu erro".
describe("POST /campaigns — erros com código e orientação", () => {
  beforeEach(() => {
    selectResults.length = 0;
    updateSetCalls.length = 0;
    insertValuesMock.mockClear();

    resolveChannelByIdMock.mockReset().mockResolvedValue({ provider: "cloud_api" });
    listChannelIdsForUserMock.mockReset();
    resolveCampaignAudienceMock.mockReset().mockResolvedValue([
      { id: CLIENT_ID, name: "Cliente 1", phone: "22999999999", whatsappOptOut: false },
    ]);
    analyzeBotCompatibilityMock.mockReset();
    buildCampaignContentSnapshotMock.mockReset().mockResolvedValue("snapshot-1");
    fingerprintForClientMock.mockReset().mockReturnValue("fp-1");
    reserveCampaignMessageMock.mockReset().mockResolvedValue({ queued: true });
  });

  async function post() {
    return request(makeApp())
      .post("/api/whatsapp/campaigns")
      .send({ campaignId: CAMPAIGN_ID, audience: { mode: "explicit", clientIds: [CLIENT_ID] } });
  }

  it("canal removido/desconectado → CHANNEL_DISCONNECTED com orientação de reconectar", async () => {
    selectResults.push([baseCampaignRow]);
    selectResults.push([]); // canal não encontrado (inativo ou excluído)

    const res = await post();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CHANNEL_DISCONNECTED");
    expect(res.body.hint).toMatch(/Canais/i);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it("template em canal não Cloud API → CHANNEL_NOT_CLOUD_API", async () => {
    resolveChannelByIdMock.mockResolvedValue({ provider: "baileys" });
    selectResults.push([baseCampaignRow]);
    selectResults.push([baseChannelRow]);

    const res = await post();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CHANNEL_NOT_CLOUD_API");
  });

  it("campanha sem canal → CAMPAIGN_NO_CHANNEL", async () => {
    selectResults.push([{ ...baseCampaignRow, waChannelId: null }]);

    const res = await post();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CAMPAIGN_NO_CHANNEL");
  });

  it("todos os contatos com opt-out → AUDIENCE_EMPTY_ALL_OPTED_OUT", async () => {
    resolveCampaignAudienceMock.mockResolvedValue([
      { id: CLIENT_ID, name: "Cliente 1", phone: "22999999999", whatsappOptOut: true },
    ]);
    selectResults.push([baseCampaignRow]);
    selectResults.push([baseChannelRow]);

    const res = await post();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("AUDIENCE_EMPTY_ALL_OPTED_OUT");
  });

  it("nenhum telefone válido → AUDIENCE_EMPTY_NO_VALID_PHONE", async () => {
    resolveCampaignAudienceMock.mockResolvedValue([
      { id: CLIENT_ID, name: "Cliente 1", phone: "123", whatsappOptOut: false },
    ]);
    selectResults.push([baseCampaignRow]);
    selectResults.push([baseChannelRow]);

    const res = await post();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("AUDIENCE_EMPTY_NO_VALID_PHONE");
  });

  it("erro inesperado → 500 UNEXPECTED, sem vazar o texto técnico", async () => {
    // Era o pior vazamento: o catch-all devolvia `e.message` direto na tela.
    resolveCampaignAudienceMock.mockRejectedValue(
      new Error('relation "clients" does not exist'),
    );
    selectResults.push([baseCampaignRow]);
    selectResults.push([baseChannelRow]);

    const res = await post();

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("UNEXPECTED");
    expect(JSON.stringify(res.body)).not.toContain("relation");
  });
});
