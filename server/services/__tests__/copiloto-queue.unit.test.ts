import { describe, expect, it } from "vitest";

import {
  buildSellerQueues,
  type CopilotoSignalCandidate,
} from "../copiloto.service";

/**
 * Regras de corte da fila diária do Copiloto. O que está sob teste é quem o
 * vendedor VÊ: o teto por vendedor, o dedup por cliente e a reserva de slots
 * para sinais com data marcada (aniversário), que não voltam depois.
 */

function candidate(
  overrides: Partial<CopilotoSignalCandidate> = {},
): CopilotoSignalCandidate {
  return {
    clientId: "cliente-1",
    sellerId: "vendedor-1",
    type: "ciclo_vencido",
    score: 100,
    estimatedValue: 100,
    reason: "",
    payload: {},
    ...overrides,
  };
}

/** N cards de ticket alto, um por cliente — o cenário que soterrava a fila. */
function highScoringCards(count: number): CopilotoSignalCandidate[] {
  return Array.from({ length: count }, (_unused, index) =>
    candidate({
      clientId: `rico-${index}`,
      type: "campeao_silencioso",
      score: 10_000 + index,
    }),
  );
}

describe("buildSellerQueues — reserva para sinais com data marcada", () => {
  it("mantém o aniversário na fila mesmo cercado de cards de score muito maior", () => {
    const aniversario = candidate({
      clientId: "aniversariante",
      type: "aniversario",
      score: 800,
    });

    const { selected, backlog } = buildSellerQueues([
      ...highScoringCards(30),
      aniversario,
    ]);

    expect(selected).toContain(aniversario);
    expect(backlog).not.toContain(aniversario);
    expect(selected).toHaveLength(15);
  });

  it("reserva no máximo 3 slots: o 4º aniversário disputa por score como qualquer um", () => {
    const aniversarios = Array.from({ length: 4 }, (_unused, index) =>
      candidate({
        clientId: `aniversariante-${index}`,
        type: "aniversario",
        score: 800,
      }),
    );

    const { selected } = buildSellerQueues([
      ...highScoringCards(30),
      ...aniversarios,
    ]);

    const selecionados = selected.filter((card) => card.type === "aniversario");
    expect(selecionados).toHaveLength(3);
  });

  it("não desperdiça slot: sem disputa, todos os aniversários entram", () => {
    const aniversarios = Array.from({ length: 5 }, (_unused, index) =>
      candidate({
        clientId: `aniversariante-${index}`,
        type: "aniversario",
        score: 800,
      }),
    );

    const { selected, backlog } = buildSellerQueues(aniversarios);

    expect(selected).toHaveLength(5);
    expect(backlog).toHaveLength(0);
  });

  it("não altera o corte por score quando não há aniversário nenhum", () => {
    const cards = highScoringCards(20);

    const { selected, backlog } = buildSellerQueues(cards);

    expect(selected).toHaveLength(15);
    expect(backlog).toHaveLength(5);
    // Sem reserva em jogo, o corte é puramente por score: os 5 menores sobram.
    expect(selected.map((card) => card.score)).toEqual(
      [...cards].map((card) => card.score).sort((a, b) => b - a).slice(0, 15),
    );
  });
});

describe("buildSellerQueues — um card por cliente", () => {
  it("o aniversário representa o cliente mesmo perdendo no score", () => {
    const aniversario = candidate({ type: "aniversario", score: 800 });
    const ciclo = candidate({ type: "ciclo_vencido", score: 9_000 });

    const { selected, dedupedByClient } = buildSellerQueues([ciclo, aniversario]);

    expect(selected).toEqual([aniversario]);
    expect(dedupedByClient).toBe(1);
  });

  it("entre sinais sem data marcada, vence o de maior score", () => {
    const ciclo = candidate({ type: "ciclo_vencido", score: 9_000 });
    const produto = candidate({ type: "produto_abandonado", score: 300 });

    const { selected } = buildSellerQueues([produto, ciclo]);

    expect(selected).toEqual([ciclo]);
  });

  it("os sinais preteridos não vazam para o backlog — o cliente sai uma vez só", () => {
    const { selected, backlog } = buildSellerQueues([
      candidate({ type: "ciclo_vencido", score: 9_000 }),
      candidate({ type: "produto_abandonado", score: 300 }),
      candidate({ type: "campeao_silencioso", score: 5_000 }),
    ]);

    expect(selected).toHaveLength(1);
    expect(backlog).toHaveLength(0);
  });
});

describe("buildSellerQueues — isolamento e integridade", () => {
  it("aplica o teto por vendedor, não no total", () => {
    const cards = [
      ...highScoringCards(20),
      ...highScoringCards(20).map((card) =>
        candidate({ ...card, sellerId: "vendedor-2" }),
      ),
    ];

    const { selected, sellers } = buildSellerQueues(cards);

    expect(selected.filter((c) => c.sellerId === "vendedor-1")).toHaveLength(15);
    expect(selected.filter((c) => c.sellerId === "vendedor-2")).toHaveLength(15);
    expect(sellers).toBe(2);
  });

  it("todo candidato que sobrevive ao dedup termina na fila ou no backlog", () => {
    const cards = [
      ...highScoringCards(30),
      candidate({ clientId: "aniversariante", type: "aniversario", score: 800 }),
    ];

    const { selected, backlog, dedupedByClient } = buildSellerQueues(cards);

    expect(selected.length + backlog.length + dedupedByClient).toBe(cards.length);
    expect(new Set([...selected, ...backlog]).size).toBe(cards.length);
  });

  it("não quebra com lista vazia", () => {
    expect(buildSellerQueues([])).toEqual({
      selected: [],
      backlog: [],
      dedupedByClient: 0,
      sellers: 0,
    });
  });
});
