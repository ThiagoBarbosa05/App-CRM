/**
 * Conferência de caixa do PDV Restaurante — aritmética pura, em centavos.
 *
 * Regra central: **só dinheiro é contado**. Cartão e Pix são conferidos no
 * resumo, mas não estão na gaveta — misturá-los ao valor esperado em espécie
 * é o erro clássico desse tipo de tela.
 */

import { toCents, fromCents } from "./restaurant-order-totals";

export type CashMovementType = "sangria" | "suprimento";

export interface CashMovementInput {
  type: CashMovementType;
  amount: string | number;
}

export interface PaymentInput {
  method: string;
  amount: string | number;
}

export interface ExpectedCashInput {
  openingFloat: string | number;
  /** Pagamentos das comandas da sessão (todos os meios; o cálculo filtra). */
  payments: PaymentInput[];
  movements: CashMovementInput[];
}

export interface ExpectedCash {
  openingFloatCents: number;
  cashPaymentsCents: number;
  suprimentosCents: number;
  sangriasCents: number;
  expectedCents: number;
}

/**
 * Esperado em espécie = fundo de troco + dinheiro recebido + suprimentos −
 * sangrias. Pagamentos em cartão e Pix ficam de fora de propósito.
 */
export function calculateExpectedCash({
  openingFloat,
  payments,
  movements,
}: ExpectedCashInput): ExpectedCash {
  const openingFloatCents = toCents(openingFloat);

  const cashPaymentsCents = payments
    .filter((p) => p.method === "dinheiro")
    .reduce((sum, p) => sum + toCents(p.amount), 0);

  const suprimentosCents = movements
    .filter((m) => m.type === "suprimento")
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  const sangriasCents = movements
    .filter((m) => m.type === "sangria")
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  return {
    openingFloatCents,
    cashPaymentsCents,
    suprimentosCents,
    sangriasCents,
    expectedCents:
      openingFloatCents + cashPaymentsCents + suprimentosCents - sangriasCents,
  };
}

/** Diferença de contagem. Negativa = quebra de caixa (faltou dinheiro). */
export function calculateCashDifference(
  countedCash: string | number,
  expectedCents: number,
): number {
  return toCents(countedCash) - expectedCents;
}

export interface SummaryOrderInput {
  id: string;
  waiterId: string;
  total: string | number | null;
  subtotal: string | number | null;
  discountAmount: string | number | null;
  discountPercent: string | number | null;
}

export interface BuildSummaryInput {
  openingFloat: string | number;
  closedOrders: SummaryOrderInput[];
  cancelledOrders: { id: string; subtotal: string | number | null }[];
  payments: PaymentInput[];
  movements: CashMovementInput[];
  waiterNameById: Record<string, string>;
}

export interface CashSessionSummary {
  orderCount: number;
  ordersTotal: string;
  paymentsTotal: string;
  /**
   * `paymentsTotal − ordersTotal`. Deveria ser sempre zero: o fechamento de
   * comanda tolera 1 centavo de diferença por comanda, então em volume isso
   * acumula. Explicitar é o ponto — antes ninguém comparava os dois números.
   */
  divergence: string;
  discountTotal: string;
  cancelledOrderCount: number;
  cancelledTotal: string;
  byPaymentMethod: { method: string; total: string }[];
  byWaiter: { waiterId: string; waiterName: string; total: string; orderCount: number }[];
  cash: {
    openingFloat: string;
    cashPayments: string;
    suprimentos: string;
    sangrias: string;
    expected: string;
  };
}

/**
 * Monta o snapshot gravado no fechamento. Recebe as linhas já buscadas para
 * poder ser testado sem banco.
 */
export function buildCashSessionSummary({
  openingFloat,
  closedOrders,
  cancelledOrders,
  payments,
  movements,
  waiterNameById,
}: BuildSummaryInput): CashSessionSummary {
  const ordersTotalCents = closedOrders.reduce(
    (sum, o) => sum + toCents(o.total ?? 0),
    0,
  );
  const paymentsTotalCents = payments.reduce((sum, p) => sum + toCents(p.amount), 0);

  const discountTotalCents = closedOrders.reduce((sum, o) => {
    if (o.discountAmount) return sum + toCents(o.discountAmount);
    if (o.discountPercent) {
      return sum + Math.round(toCents(o.subtotal ?? 0) * (Number(o.discountPercent) / 100));
    }
    return sum;
  }, 0);

  const byMethod = new Map<string, number>();
  for (const p of payments) {
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + toCents(p.amount));
  }

  const byWaiter = new Map<string, { total: number; orderCount: number }>();
  for (const o of closedOrders) {
    const entry = byWaiter.get(o.waiterId) ?? { total: 0, orderCount: 0 };
    entry.total += toCents(o.total ?? 0);
    entry.orderCount += 1;
    byWaiter.set(o.waiterId, entry);
  }

  const cash = calculateExpectedCash({ openingFloat, payments, movements });

  return {
    orderCount: closedOrders.length,
    ordersTotal: fromCents(ordersTotalCents),
    paymentsTotal: fromCents(paymentsTotalCents),
    divergence: fromCents(paymentsTotalCents - ordersTotalCents),
    discountTotal: fromCents(discountTotalCents),
    cancelledOrderCount: cancelledOrders.length,
    cancelledTotal: fromCents(
      cancelledOrders.reduce((sum, o) => sum + toCents(o.subtotal ?? 0), 0),
    ),
    byPaymentMethod: Array.from(byMethod.entries()).map(([method, cents]) => ({
      method,
      total: fromCents(cents),
    })),
    byWaiter: Array.from(byWaiter.entries()).map(([waiterId, entry]) => ({
      waiterId,
      waiterName: waiterNameById[waiterId] ?? "—",
      total: fromCents(entry.total),
      orderCount: entry.orderCount,
    })),
    cash: {
      openingFloat: fromCents(cash.openingFloatCents),
      cashPayments: fromCents(cash.cashPaymentsCents),
      suprimentos: fromCents(cash.suprimentosCents),
      sangrias: fromCents(cash.sangriasCents),
      expected: fromCents(cash.expectedCents),
    },
  };
}
