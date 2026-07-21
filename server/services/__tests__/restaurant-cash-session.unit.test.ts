import { describe, it, expect } from "vitest";
import {
  calculateExpectedCash,
  calculateCashDifference,
  buildCashSessionSummary,
} from "../../../shared/restaurant-cash-session";

describe("calculateExpectedCash", () => {
  it("conta apenas pagamentos em dinheiro — cartão e Pix não estão na gaveta", () => {
    const result = calculateExpectedCash({
      openingFloat: "200.00",
      payments: [
        { method: "dinheiro", amount: "50.00" },
        { method: "cartao_credito", amount: "300.00" },
        { method: "pix", amount: "120.00" },
        { method: "dinheiro", amount: "30.00" },
      ],
      movements: [],
    });

    expect(result.cashPaymentsCents).toBe(8000);
    expect(result.expectedCents).toBe(28000); // 200 de fundo + 80 em espécie
  });

  it("soma suprimento e subtrai sangria", () => {
    const result = calculateExpectedCash({
      openingFloat: "100.00",
      payments: [{ method: "dinheiro", amount: "500.00" }],
      movements: [
        { type: "sangria", amount: "400.00" },
        { type: "suprimento", amount: "50.00" },
      ],
    });

    expect(result.sangriasCents).toBe(40000);
    expect(result.suprimentosCents).toBe(5000);
    expect(result.expectedCents).toBe(25000); // 100 + 500 - 400 + 50
  });

  it("caixa sem movimento nenhum devolve o fundo de troco", () => {
    const result = calculateExpectedCash({
      openingFloat: "150.00",
      payments: [],
      movements: [],
    });

    expect(result.expectedCents).toBe(15000);
  });

  it("não perde centavos com valores quebrados", () => {
    const result = calculateExpectedCash({
      openingFloat: "0.10",
      payments: [
        { method: "dinheiro", amount: "0.20" },
        { method: "dinheiro", amount: "0.10" },
      ],
      movements: [],
    });

    expect(result.expectedCents).toBe(40);
  });
});

describe("calculateCashDifference", () => {
  it("diferença negativa indica quebra de caixa", () => {
    expect(calculateCashDifference("280.00", 30000)).toBe(-2000);
  });

  it("diferença positiva indica sobra", () => {
    expect(calculateCashDifference("310.00", 30000)).toBe(1000);
  });

  it("caixa conferido fecha em zero", () => {
    expect(calculateCashDifference("300.00", 30000)).toBe(0);
  });
});

describe("buildCashSessionSummary", () => {
  const baseOrders = [
    {
      id: "o1",
      waiterId: "w1",
      total: "110.00",
      subtotal: "100.00",
      discountAmount: null,
      discountPercent: null,
    },
    {
      id: "o2",
      waiterId: "w2",
      total: "220.00",
      subtotal: "200.00",
      discountAmount: null,
      discountPercent: null,
    },
  ];

  it("agrega total, meios de pagamento e garçons", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "100.00",
      closedOrders: baseOrders,
      cancelledOrders: [],
      payments: [
        { method: "dinheiro", amount: "110.00" },
        { method: "pix", amount: "220.00" },
      ],
      movements: [],
      waiterNameById: { w1: "Ana", w2: "Bruno" },
    });

    expect(summary.orderCount).toBe(2);
    expect(summary.ordersTotal).toBe("330.00");
    expect(summary.paymentsTotal).toBe("330.00");
    expect(summary.divergence).toBe("0.00");
    expect(summary.byPaymentMethod).toEqual([
      { method: "dinheiro", total: "110.00" },
      { method: "pix", total: "220.00" },
    ]);
    expect(summary.byWaiter).toEqual([
      { waiterId: "w1", waiterName: "Ana", total: "110.00", orderCount: 1 },
      { waiterId: "w2", waiterName: "Bruno", total: "220.00", orderCount: 1 },
    ]);
  });

  it("expõe divergência entre total das comandas e soma dos pagamentos", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "0.00",
      closedOrders: baseOrders,
      cancelledOrders: [],
      // 2 centavos a mais que o total das comandas (tolerância acumulada)
      payments: [{ method: "dinheiro", amount: "330.02" }],
      movements: [],
      waiterNameById: {},
    });

    expect(summary.divergence).toBe("0.02");
  });

  it("registra comandas canceladas, que não entram na receita", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "0.00",
      closedOrders: baseOrders,
      cancelledOrders: [{ id: "c1", subtotal: "400.00" }],
      payments: [{ method: "dinheiro", amount: "330.00" }],
      movements: [],
      waiterNameById: {},
    });

    expect(summary.cancelledOrderCount).toBe(1);
    expect(summary.cancelledTotal).toBe("400.00");
    expect(summary.ordersTotal).toBe("330.00");
  });

  it("totaliza desconto em valor e percentual", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "0.00",
      closedOrders: [
        {
          id: "o1",
          waiterId: "w1",
          total: "88.00",
          subtotal: "100.00",
          discountAmount: "20.00",
          discountPercent: null,
        },
        {
          id: "o2",
          waiterId: "w1",
          total: "187.00",
          subtotal: "200.00",
          discountAmount: null,
          discountPercent: "15.00",
        },
      ],
      cancelledOrders: [],
      payments: [],
      movements: [],
      waiterNameById: { w1: "Ana" },
    });

    expect(summary.discountTotal).toBe("50.00"); // 20 + 30
  });

  it("garçom sem nome cadastrado não quebra o resumo", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "0.00",
      closedOrders: baseOrders,
      cancelledOrders: [],
      payments: [],
      movements: [],
      waiterNameById: {},
    });

    expect(summary.byWaiter.map((w) => w.waiterName)).toEqual(["—", "—"]);
  });

  it("bloco de espécie separa dinheiro dos demais meios", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "200.00",
      closedOrders: baseOrders,
      cancelledOrders: [],
      payments: [
        { method: "dinheiro", amount: "110.00" },
        { method: "cartao_debito", amount: "220.00" },
      ],
      movements: [{ type: "sangria", amount: "100.00" }],
      waiterNameById: {},
    });

    expect(summary.cash).toEqual({
      openingFloat: "200.00",
      cashPayments: "110.00",
      suprimentos: "0.00",
      sangrias: "100.00",
      expected: "210.00", // 200 + 110 - 100; o cartão fica de fora
    });
  });

  it("sessão sem comandas devolve zeros consistentes", () => {
    const summary = buildCashSessionSummary({
      openingFloat: "150.00",
      closedOrders: [],
      cancelledOrders: [],
      payments: [],
      movements: [],
      waiterNameById: {},
    });

    expect(summary.orderCount).toBe(0);
    expect(summary.ordersTotal).toBe("0.00");
    expect(summary.divergence).toBe("0.00");
    expect(summary.cash.expected).toBe("150.00");
  });
});
