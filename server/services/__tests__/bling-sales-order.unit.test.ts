import { describe, expect, it } from "vitest";
import {
  resolveBlingSalesOrderPayload,
  type ResolveBlingSalesOrderInput,
} from "../bling-sales-order.service";
import type { RestaurantOrder, RestaurantOrderItem } from "../../../shared/schema";
import { BLING_SITUACAO_PEDIDO_VENDA_ATENDIDO } from "../../integrations/bling";

/**
 * O que está sob teste: a regra de "não mandar pedido divergente" — qualquer
 * item ou contato sem correspondência no Bling bloqueia a comanda inteira em
 * vez de mandar um pedido incompleto.
 */

function makeOrder(overrides: Partial<RestaurantOrder> = {}): RestaurantOrder {
  return {
    id: "order-1",
    orderNumber: 1,
    tableId: "table-1",
    tableNumber: 5,
    peopleCount: 2,
    waiterId: "waiter-1",
    cashSessionId: "session-1",
    status: "fechada",
    paymentRequestedAt: null,
    paymentMethod: "pix",
    subtotal: "100.00",
    serviceFeePercent: "10.00",
    serviceFeeAmount: "10.00",
    total: "110.00",
    discountPercent: null,
    discountAmount: null,
    discountReason: null,
    discountAppliedBy: null,
    clientId: null,
    clientName: null,
    mergedIntoOrderId: null,
    blingConnectionId: "conn-1",
    notes: null,
    unitId: "unit-1",
    openedAt: new Date("2026-07-26T20:00:00Z"),
    closedAt: new Date("2026-07-26T21:30:00Z"),
    createdAt: new Date("2026-07-26T20:00:00Z"),
    updatedAt: new Date("2026-07-26T21:30:00Z"),
    blingSyncStatus: "pendente",
    blingSalesOrderId: null,
    blingSalesOrderNumber: null,
    blingSyncError: null,
    blingSyncAttempts: 0,
    blingSyncAttemptedAt: null,
    blingCheckStatus: null,
    blingCheckDetail: null,
    blingCheckedAt: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<RestaurantOrderItem> = {}): RestaurantOrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    menuItemId: null,
    productId: "product-1",
    name: "Vinho Tinto",
    notes: null,
    unitPrice: "100.00",
    quantity: 1,
    status: "ativo",
    cancelReason: null,
    cancelledBy: null,
    cancelledAt: null,
    createdAt: new Date("2026-07-26T20:05:00Z"),
    updatedAt: new Date("2026-07-26T20:05:00Z"),
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ResolveBlingSalesOrderInput> = {},
): ResolveBlingSalesOrderInput {
  return {
    order: makeOrder(),
    items: [makeItem()],
    blingProductIdByProductId: new Map([["product-1", "9001"]]),
    contactBlingId: "5001",
    sellerBlingId: null,
    ...overrides,
  };
}

describe("resolveBlingSalesOrderPayload", () => {
  it("monta o payload quando item e contato estão resolvidos", () => {
    const result = resolveBlingSalesOrderPayload(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.contato).toEqual({ id: 5001 });
    expect(result.payload.itens).toEqual([
      { produto: { id: 9001 }, descricao: "Vinho Tinto", quantidade: 1, valor: 100 },
    ]);
    expect(result.payload.parcelas).toEqual([
      { dataVencimento: "2026-07-26", valor: 110 },
    ]);
    expect(result.payload.data).toBe("2026-07-26");
  });

  /**
   * Sem `situacao` o Bling cria o pedido em "Em aberto" (6), e a comanda paga
   * volta pelo webhook como venda não concluída — fora de todo o faturamento,
   * que filtra por `situation_id = '9'`.
   */
  it("cria o pedido já na situação Atendido", () => {
    const result = resolveBlingSalesOrderPayload(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.situacao).toEqual({
      id: BLING_SITUACAO_PEDIDO_VENDA_ATENDIDO,
    });
    expect(BLING_SITUACAO_PEDIDO_VENDA_ATENDIDO).toBe(9);
  });

  /**
   * A regressão central: antes o payload levava só os itens (R$ 100) e uma
   * parcela de R$ 110. O Bling gravava o pedido valendo 100 com uma parcela de
   * 110 — divergente por construção em toda comanda com taxa de serviço.
   */
  it("envia a taxa de serviço em outrasDespesas, fechando com o total da comanda", () => {
    const result = resolveBlingSalesOrderPayload(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.outrasDespesas).toBe(10);

    const itensTotal = result.payload.itens.reduce(
      (sum, i) => sum + i.valor * i.quantidade,
      0,
    );
    expect(itensTotal + (result.payload.outrasDespesas ?? 0)).toBe(110);
    expect(result.payload.parcelas[0].valor).toBe(110);
  });

  it("omite outrasDespesas quando não há taxa", () => {
    for (const serviceFeeAmount of [null, "0.00"]) {
      const result = resolveBlingSalesOrderPayload(
        baseInput({
          order: makeOrder({ serviceFeeAmount, serviceFeePercent: "0.00", total: "100.00" }),
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("esperava ok:true");
      expect(result.payload.outrasDespesas).toBeUndefined();
      expect(result.payload.parcelas[0].valor).toBe(100);
    }
  });

  it("envia o desconto em valor", () => {
    // 100 − 20 = 80 de base, taxa de 10% sobre isso = 8 → total 88
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        order: makeOrder({
          discountAmount: "20.00",
          serviceFeeAmount: "8.00",
          total: "88.00",
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.desconto).toEqual({ valor: 20, unidade: "REAL" });
    expect(result.payload.outrasDespesas).toBe(8);
    expect(result.payload.parcelas[0].valor).toBe(88);
  });

  /**
   * `closeOrder` não grava `discountAmount`, só o percentual. Ler apenas a
   * coluna de valor faria o desconto sumir do pedido justamente nas comandas
   * em que o gestor aplicou percentual.
   */
  it("deriva o desconto do percentual quando o valor não foi gravado", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        order: makeOrder({
          discountAmount: null,
          discountPercent: "20.00",
          serviceFeeAmount: "8.00",
          total: "88.00",
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.desconto).toEqual({ valor: 20, unidade: "REAL" });
  });

  it("omite desconto quando não há", () => {
    const result = resolveBlingSalesOrderPayload(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.desconto).toBeUndefined();
  });

  it("bloqueia quando os totais da comanda não fecham entre si", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({ order: makeOrder({ total: "999.00" }) }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("Totais internos inconsistentes");
  });

  it("não deixa resíduo de ponto flutuante em valores quebrados", () => {
    // 3 × 33,33 = 99,99; taxa de 10% = 10,00 (arredondado) → 109,99
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        order: makeOrder({
          subtotal: "99.99",
          serviceFeeAmount: "10.00",
          total: "109.99",
        }),
        items: [makeItem({ unitPrice: "33.33", quantity: 3 })],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.itens[0].valor).toBe(33.33);
    expect(result.payload.outrasDespesas).toBe(10);
    expect(result.payload.parcelas[0].valor).toBe(109.99);
    expect(JSON.stringify(result.payload)).not.toContain("0000000");
  });

  it("bloqueia quando um item avulso não tem productId", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        items: [makeItem({ productId: null, name: "Caipirinha avulsa" })],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("Caipirinha avulsa");
  });

  it("bloqueia quando o produto não tem bling_product_id mapeado para a conexão", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({ blingProductIdByProductId: new Map() }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("Vinho Tinto");
  });

  it("bloqueia quando não há contato Bling resolvido (sem cliente e sem consumidor final)", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ contactBlingId: null }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("contato Bling");
  });

  it("inclui vendedor no payload quando sellerBlingId está presente", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ sellerBlingId: "7001" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.vendedor).toEqual({ id: 7001 });
  });

  it("omite vendedor quando sellerBlingId é null", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ sellerBlingId: null }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.vendedor).toBeUndefined();
  });
});

describe("resolveBlingSalesOrderPayload — parcelas por pagamento", () => {
  it("sem pagamentos, mantém a parcela única sem formaPagamento", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ payments: [] }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.parcelas).toEqual([
      { dataVencimento: "2026-07-26", valor: 110 },
    ]);
  });

  it("gera uma parcela por pagamento com formaPagamento e soma = total", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        payments: [
          { amount: "60.00", blingPaymentMethodId: "111" },
          { amount: "50.00", blingPaymentMethodId: "222" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.parcelas).toEqual([
      { dataVencimento: "2026-07-26", valor: 60, formaPagamento: { id: 111 } },
      { dataVencimento: "2026-07-26", valor: 50, formaPagamento: { id: 222 } },
    ]);
  });

  it("a última parcela absorve a diferença de 1 centavo tolerada no fechamento", () => {
    // 55,00 + 55,01 = 110,01 (1 centavo acima do total 110,00, aceito pela
    // validação do fechamento) → última parcela vira 55,00 para fechar em 110.
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        payments: [
          { amount: "55.00", blingPaymentMethodId: "111" },
          { amount: "55.01", blingPaymentMethodId: "222" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    const soma = result.payload.parcelas.reduce((s, p) => s + p.valor, 0);
    expect(soma).toBe(110);
    expect(result.payload.parcelas[1].valor).toBe(55);
  });

  it("pagamento sem forma Bling vira parcela sem formaPagamento", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        payments: [
          { amount: "60.00", blingPaymentMethodId: "111" },
          { amount: "50.00", blingPaymentMethodId: null },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.parcelas[0].formaPagamento).toEqual({ id: 111 });
    expect(result.payload.parcelas[1].formaPagamento).toBeUndefined();
  });

  it("bloqueia (sem lançar) quando um pagamento tem valor inválido", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        payments: [
          { amount: "abc", blingPaymentMethodId: "111" },
          { amount: "50.00", blingPaymentMethodId: "222" },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("valor inválido");
  });
});
