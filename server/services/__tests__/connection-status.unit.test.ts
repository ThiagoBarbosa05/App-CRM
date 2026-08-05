import { describe, expect, it, vi } from "vitest";

// O service importa `server/db` no topo, que abre um Pool real na importação.
// A regra testada aqui é pura — mockar o módulo basta para não tocar o banco.
vi.mock("../../db", () => ({ db: {}, pool: {} }));
vi.mock("../../lib/sse-hub", () => ({ publishSseEvent: () => {} }));
vi.mock("../whatsapp-channels.service", () => ({
  invalidateChannelDirectory: () => {},
  listQrReaderUserIdsForChannel: async () => [],
}));

import { decideStatusTransition } from "../baileys/connection-status.service";

// A guarda de ordem existe porque o gateway entrega webhooks com concorrência 4
// e backoff independente por evento: um "close" reentregue pode chegar depois
// de um "open". Sem descartar o mais antigo, o canal fica com o status
// invertido — que foi exatamente o bug relatado (CRM "Conectado", sessão morta).

const T0 = new Date("2026-08-04T21:00:00.000Z");
const T1 = new Date("2026-08-04T21:05:00.000Z");

describe("decideStatusTransition", () => {
  it("aplica e notifica quando o status muda", () => {
    expect(
      decideStatusTransition(
        { status: "connected", statusAt: T0 },
        { status: "disconnected", occurredAt: T1 },
      ),
    ).toEqual({ write: true, notify: true, reason: "changed" });
  });

  it("descarta evento anterior ao último aplicado", () => {
    expect(
      decideStatusTransition(
        { status: "connected", statusAt: T1 },
        { status: "disconnected", occurredAt: T0 },
      ),
    ).toEqual({ write: false, notify: false, reason: "stale_event" });
  });

  it("aceita evento no mesmo instante do último aplicado", () => {
    expect(
      decideStatusTransition(
        { status: "connecting", statusAt: T0 },
        { status: "connected", occurredAt: T0 },
      ).write,
    ).toBe(true);
  });

  it("não escreve nada quando o status não mudou", () => {
    expect(
      decideStatusTransition(
        { status: "connected", statusAt: T0 },
        { status: "connected", occurredAt: T1 },
      ),
    ).toEqual({ write: false, notify: false, reason: "unchanged" });
  });

  // O diálogo de QR reobserva "connecting" a cada 2,5s. Se cada rodada
  // empurrasse o carimbo, o webhook `open` — cujo occurredAt é o instante real
  // da conexão — chegaria "velho" e seria descartado.
  it("reobservação repetida não bloqueia o evento de conexão que veio depois", () => {
    const reobservacao = decideStatusTransition(
      { status: "connecting", statusAt: T0 },
      { status: "connecting", occurredAt: T1 },
    );
    expect(reobservacao.write).toBe(false);

    const conexao = decideStatusTransition(
      { status: "connecting", statusAt: T0 },
      { status: "connected", occurredAt: new Date(T0.getTime() + 1_000) },
    );
    expect(conexao).toEqual({ write: true, notify: true, reason: "changed" });
  });

  it("aceita evento sem occurredAt (gateway anterior ao carimbo)", () => {
    expect(
      decideStatusTransition(
        { status: "connected", statusAt: T1 },
        { status: "disconnected" },
      ),
    ).toEqual({ write: true, notify: true, reason: "changed" });
  });

  it("aceita qualquer evento em canal que nunca teve carimbo", () => {
    expect(
      decideStatusTransition(
        { status: "disconnected", statusAt: null },
        { status: "connected", occurredAt: T0 },
      ),
    ).toEqual({ write: true, notify: true, reason: "changed" });
  });

  it("trata status nulo (canal recém-criado) como mudança", () => {
    expect(
      decideStatusTransition({ status: null, statusAt: null }, { status: "qr", occurredAt: T0 }),
    ).toEqual({ write: true, notify: true, reason: "changed" });
  });
});
