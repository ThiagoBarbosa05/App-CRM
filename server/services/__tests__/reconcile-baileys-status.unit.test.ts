import { describe, expect, it, vi, beforeEach } from "vitest";

// O job vivia morto em produção: `updateConnectionStatus` e
// `logChannelConnectionEvent` eram chamados sem import, dentro do catch do
// loop. Um único canal em 404 estourava ReferenceError, o erro escapava do
// try, o loop inteiro abortava e TODOS os canais congelavam no último status
// conhecido — daí a tela mostrar "Conectado" com a sessão morta.
//
// Fica fora de server/jobs/ de propósito: os globs do project "unit"
// (vitest.config.ts) não cobrem aquela pasta, e um teste não coletado passa
// despercebido para sempre.

const { getInstanceMock, applyStatusMock, touchCheckedAtMock, rowsRef } = vi.hoisted(() => ({
  getInstanceMock: vi.fn(),
  applyStatusMock: vi.fn(async () => ({ applied: true, status: "disconnected", reason: "changed" })),
  touchCheckedAtMock: vi.fn(async () => {}),
  rowsRef: { current: [] as Array<Record<string, unknown>> },
}));

// Cadeia do drizzle: select().from().where() devolve as linhas do teste.
vi.mock("../../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => rowsRef.current }) }),
  },
  pool: {},
}));

vi.mock("../../integrations/baileys-gateway", async (importOriginal) => ({
  // BaileysGatewayError precisa ser a classe REAL: o job decide por instanceof.
  ...(await importOriginal<typeof import("../../integrations/baileys-gateway")>()),
  baileysGateway: { getInstance: getInstanceMock },
}));

vi.mock("../baileys/connection-status.service", () => ({
  applyChannelConnectionStatus: applyStatusMock,
  touchChannelConnectionCheckedAt: touchCheckedAtMock,
}));

import { BaileysGatewayError } from "../../integrations/baileys-gateway";

/** Reimporta o módulo a cada teste, isolando qualquer estado de módulo. */
async function loadJob() {
  vi.resetModules();
  return import("../../jobs/reconcile-baileys-status.job");
}

function channel(
  id: number,
  connectionStatus = "connected",
  connectionCheckedAt: Date | null = new Date(),
) {
  return { id, evolutionInstanceName: `canal-${id}`, connectionStatus, connectionCheckedAt };
}

/** Um instante `minutes` minutos no passado, para montar a janela de graça. */
function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

function instance(overrides: Record<string, unknown> = {}) {
  return { observed_state: "connected", observed_state_stale: false, ...overrides };
}

describe("reconcileBaileysStatus", () => {
  beforeEach(() => {
    getInstanceMock.mockReset();
    applyStatusMock.mockClear();
    touchCheckedAtMock.mockClear();
    rowsRef.current = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("um canal 404 não impede a reconciliação dos demais (regressão do ReferenceError)", async () => {
    rowsRef.current = [channel(1), channel(2), channel(3)];
    getInstanceMock
      .mockRejectedValueOnce(new BaileysGatewayError("sumiu", "not_found", 404))
      .mockResolvedValueOnce(instance({ observed_state: "close" }))
      .mockResolvedValueOnce(instance());

    const { reconcileBaileysStatus } = await loadJob();
    await reconcileBaileysStatus();

    expect(getInstanceMock).toHaveBeenCalledTimes(3);
    expect(applyStatusMock).toHaveBeenCalledWith(
      1,
      "disconnected",
      expect.objectContaining({ reasonCode: "INSTANCE_NOT_FOUND", source: "reconcile" }),
    );
    // O canal 2 (gateway diz "close") também precisa ter sido corrigido.
    expect(applyStatusMock).toHaveBeenCalledWith(
      2,
      "disconnected",
      expect.objectContaining({ source: "reconcile" }),
    );
    // O canal 3 continua conectado: nada a aplicar, mas verificação renovada.
    expect(applyStatusMock).not.toHaveBeenCalledWith(3, expect.anything(), expect.anything());
    expect(touchCheckedAtMock).toHaveBeenCalledWith(3);
  });

  it("trata heartbeat velho do gateway como desconectado", async () => {
    rowsRef.current = [channel(1)];
    getInstanceMock.mockResolvedValue(instance({ observed_state_stale: true }));

    const { reconcileBaileysStatus } = await loadJob();
    await reconcileBaileysStatus();

    expect(applyStatusMock).toHaveBeenCalledWith(
      1,
      "disconnected",
      expect.objectContaining({ reasonLabel: "Gateway parou de responder pela sessão" }),
    );
  });

  it("degrada quando ninguém confirma o canal há mais que a janela de graça", async () => {
    rowsRef.current = [channel(1, "connected", minutesAgo(31))];
    getInstanceMock.mockRejectedValue(
      new BaileysGatewayError("Baileys Gateway indisponível", "unavailable"),
    );

    const { reconcileBaileysStatus } = await loadJob();
    await reconcileBaileysStatus();

    expect(applyStatusMock).toHaveBeenCalledWith(
      1,
      "disconnected",
      expect.objectContaining({ reasonCode: "GATEWAY_UNREACHABLE" }),
    );
  });

  it("tolera o gateway fora enquanto a confirmação do canal ainda é recente", async () => {
    // A tolerância vem de `connection_checked_at`, não de um contador em
    // memória: o job roda em container efêmero, onde um contador zeraria a
    // cada execução e o canal nunca degradaria.
    rowsRef.current = [channel(1, "connected", minutesAgo(5))];
    getInstanceMock.mockRejectedValue(
      new BaileysGatewayError("Baileys Gateway indisponível", "unavailable"),
    );

    const { reconcileBaileysStatus } = await loadJob();
    await reconcileBaileysStatus();
    await reconcileBaileysStatus();
    await reconcileBaileysStatus();

    expect(applyStatusMock).not.toHaveBeenCalled();
  });

  it("não degrada canal que o gateway nunca confirmou", async () => {
    // Sem nenhuma confirmação anterior não há indisponibilidade a comprovar, e
    // marcar "offline" sobrescreveria um estado que ninguém verificou.
    rowsRef.current = [channel(1, "connected", null)];
    getInstanceMock.mockRejectedValue(
      new BaileysGatewayError("Baileys Gateway indisponível", "unavailable"),
    );

    const { reconcileBaileysStatus } = await loadJob();
    await reconcileBaileysStatus();

    expect(applyStatusMock).not.toHaveBeenCalled();
  });

  it("não degrada por erro de configuração do CRM (401 não prova nada sobre a sessão)", async () => {
    rowsRef.current = [channel(1)];
    getInstanceMock.mockRejectedValue(
      new BaileysGatewayError("Não autorizado", "unauthorized", 401),
    );

    const { reconcileBaileysStatus } = await loadJob();
    for (let i = 0; i < 5; i += 1) await reconcileBaileysStatus();

    expect(applyStatusMock).not.toHaveBeenCalled();
  });
});
