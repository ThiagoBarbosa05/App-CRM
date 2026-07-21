import { describe, it, expect } from "vitest";
import { splitEqualCents, splitByGroupsCents, initialSplitPeople } from "../split-bill";

describe("initialSplitPeople", () => {
  /**
   * O número de pessoas era pedido na abertura da mesa e ignorado no
   * fechamento: a divisão começava fixa em 2. Mesa de seis precisava ser
   * corrigida à mão toda vez, e quem esquecesse dividia a conta errado.
   */
  it("usa o número de pessoas registrado na abertura da mesa", () => {
    expect(initialSplitPeople(6)).toBe(6);
    expect(initialSplitPeople(2)).toBe(2);
    expect(initialSplitPeople(20)).toBe(20);
  });

  it("cai para 2 quando a mesa não tem gente suficiente para dividir", () => {
    expect(initialSplitPeople(1)).toBe(2);
    expect(initialSplitPeople(0)).toBe(2);
  });

  it("cai para 2 em dado inválido em vez de propagar NaN para a divisão", () => {
    expect(initialSplitPeople(NaN)).toBe(2);
    expect(initialSplitPeople(-3)).toBe(2);
    expect(initialSplitPeople(Infinity)).toBe(2);
  });

  it("trunca fracionário — não existe meia pessoa dividindo a conta", () => {
    expect(initialSplitPeople(4.7)).toBe(4);
  });

  it("sempre produz um número que `splitEqualCents` aceita", () => {
    for (const input of [NaN, -1, 0, 1, 2.5, 6, 99]) {
      const people = initialSplitPeople(input);
      const shares = splitEqualCents(10000, people);
      expect(shares).toHaveLength(people);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(10000);
    }
  });
});

describe("splitEqualCents", () => {
  it("divide valor exato igualmente", () => {
    expect(splitEqualCents(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("distribui a sobra nas primeiras pessoas — soma fecha com o total", () => {
    const shares = splitEqualCents(10000, 3);

    expect(shares).toEqual([3334, 3333, 3333]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("fecha a soma para qualquer número de pessoas", () => {
    for (let people = 2; people <= 20; people++) {
      const shares = splitEqualCents(19837, people);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(19837);
      expect(shares).toHaveLength(people);
    }
  });

  it("nunca produz parcelas com diferença maior que um centavo", () => {
    const shares = splitEqualCents(10000, 7);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("trata zero pessoas como uma", () => {
    expect(splitEqualCents(5000, 0)).toEqual([5000]);
  });
});

describe("splitByGroupsCents", () => {
  it("rateia taxa de serviço proporcionalmente ao consumo", () => {
    // Grupos de R$ 60 e R$ 40; serviço 10% = R$ 10; total R$ 110.
    const result = splitByGroupsCents({
      groupSubtotalsCents: [6000, 4000],
      subtotalCents: 10000,
      discountCents: 0,
      serviceFeeCents: 1000,
      totalCents: 11000,
    });

    expect(result).toEqual([6600, 4400]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(11000);
  });

  it("rateia desconto junto com a taxa", () => {
    const result = splitByGroupsCents({
      groupSubtotalsCents: [5000, 5000],
      subtotalCents: 10000,
      discountCents: 2000,
      serviceFeeCents: 800,
      totalCents: 8800,
    });

    expect(result).toEqual([4400, 4400]);
  });

  it("último grupo absorve a sobra do arredondamento", () => {
    const result = splitByGroupsCents({
      groupSubtotalsCents: [3333, 3333, 3334],
      subtotalCents: 10000,
      discountCents: 0,
      serviceFeeCents: 1000,
      totalCents: 11000,
    });

    expect(result.reduce((a, b) => a + b, 0)).toBe(11000);
  });

  it("comanda sem valor zera todos os grupos", () => {
    expect(
      splitByGroupsCents({
        groupSubtotalsCents: [0, 0],
        subtotalCents: 0,
        discountCents: 0,
        serviceFeeCents: 0,
        totalCents: 0,
      }),
    ).toEqual([0, 0]);
  });

  it("sem grupos devolve lista vazia", () => {
    expect(
      splitByGroupsCents({
        groupSubtotalsCents: [],
        subtotalCents: 10000,
        discountCents: 0,
        serviceFeeCents: 1000,
        totalCents: 11000,
      }),
    ).toEqual([]);
  });
});
