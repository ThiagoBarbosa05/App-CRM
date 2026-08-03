import { describe, expect, it } from "vitest";

import { compareBlingSalesOrderTotals } from "../../../shared/bling-sales-order-check";
import { shouldSkipBlingSend } from "../bling-sales-order.service";

/** Comanda de R$ 100 de produtos + 10% de taxa = R$ 110. */
const expected = {
  totalCents: 11000,
  subtotalCents: 10000,
  serviceFeeCents: 1000,
  discountCents: 0,
};

describe("compareBlingSalesOrderTotals", () => {
  it("aprova quando o Bling somou a taxa e o total bate", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 4321, total: 110, totalProdutos: 100, outrasDespesas: 10 },
      expected,
    });

    expect(result.status).toBe("ok");
    expect(result.detail).toBeNull();
    expect(result.blingOrderNumber).toBe("4321");
  });

  it("aceita diferença de 1 centavo (arredondamento de rateio)", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 1, total: 110.01, totalProdutos: 100, outrasDespesas: 10 },
      expected,
    });

    expect(result.status).toBe("ok");
  });

  /**
   * O desfecho que a implementação existe para detectar: o campo foi aceito e
   * gravado, mas o Bling não o inclui no total. Sem esse diagnóstico, a tela
   * diria só "divergente" e ninguém saberia que a taxa precisa ir por outro
   * caminho.
   */
  it("identifica quando o Bling grava outras despesas mas não soma ao total", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 7, total: 100, totalProdutos: 100, outrasDespesas: 10 },
      expected,
    });

    expect(result.status).toBe("divergente");
    expect(result.detail).toContain("NÃO somadas ao total");
    expect(result.detail).toContain("R$ 100.00");
    expect(result.detail).toContain("R$ 110.00");
  });

  it("identifica campo rejeitado (outras despesas zeradas)", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 7, total: 100, totalProdutos: 100, outrasDespesas: 0 },
      expected,
    });

    expect(result.status).toBe("divergente");
    expect(result.detail).toContain("outras despesas R$ 0.00");
    expect(result.detail).not.toContain("NÃO somadas");
  });

  it("identifica unidade errada (centavos em vez de reais)", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 7, total: 1100, totalProdutos: 100, outrasDespesas: 1000 },
      expected,
    });

    expect(result.status).toBe("divergente");
    expect(result.detail).toContain("outras despesas R$ 1000.00");
  });

  it("aponta desconto divergente quando ele desloca o total", () => {
    // Comanda: 100 de produtos − 20 de desconto + 8 de taxa = 88.
    // O Bling gravou só 5 de desconto, então fechou em 103.
    const result = compareBlingSalesOrderTotals({
      blingOrder: {
        numero: 9,
        total: 103,
        totalProdutos: 100,
        outrasDespesas: 8,
        desconto: { valor: 5 },
      },
      expected: {
        totalCents: 8800,
        subtotalCents: 10000,
        serviceFeeCents: 800,
        discountCents: 2000,
      },
    });

    expect(result.status).toBe("divergente");
    expect(result.detail).toContain("desconto R$ 5.00");
    expect(result.detail).toContain("R$ 20.00");
  });

  /**
   * O veredito é dado só pelo total — os campos são diagnóstico. Um campo
   * individual diferente que não desloca o total (ex.: o Bling redistribuiu
   * internamente) não é divergência de dinheiro.
   */
  it("não acusa divergência quando o total fecha, mesmo com campos diferentes", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 9, total: 110, totalProdutos: 110, outrasDespesas: 0 },
      expected,
    });

    expect(result.status).toBe("ok");
  });

  it("mantém os alertas do Bling no detalhe mesmo quando o total bate", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: 4321, total: 110, totalProdutos: 100, outrasDespesas: 10 },
      expected,
      alertas: ["Parcela com valor divergente"],
    });

    expect(result.status).toBe("ok");
    expect(result.detail).toContain("Parcela com valor divergente");
  });

  it("trata pedido sem número e sem desconto", () => {
    const result = compareBlingSalesOrderTotals({
      blingOrder: { numero: null, total: 110, totalProdutos: 100, outrasDespesas: 10, desconto: null },
      expected,
    });

    expect(result.status).toBe("ok");
    expect(result.blingOrderNumber).toBeNull();
  });
});

describe("shouldSkipBlingSend", () => {
  /**
   * O guard que impede o pior desfecho do módulo: dois pedidos de venda para a
   * mesma comanda. Antes não existia — um reenvio manual de comanda já
   * sincronizada criaria o segundo.
   */
  it("pula comanda que já tem pedido de venda", () => {
    expect(
      shouldSkipBlingSend({ blingSyncStatus: "enviado", blingSalesOrderId: "12345" }),
    ).toBe(true);
  });

  it("não pula quando o status é enviado mas o id não foi gravado", () => {
    expect(
      shouldSkipBlingSend({ blingSyncStatus: "enviado", blingSalesOrderId: null }),
    ).toBe(false);
  });

  it.each(["pendente", "erro", "bloqueado", null] as const)(
    "não pula status %s",
    (status) => {
      expect(
        shouldSkipBlingSend({ blingSyncStatus: status, blingSalesOrderId: null }),
      ).toBe(false);
    },
  );
});
