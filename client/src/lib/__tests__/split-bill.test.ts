import { describe, it, expect } from "vitest";
import { splitEqualCents, splitByGroupsCents } from "../split-bill";

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
