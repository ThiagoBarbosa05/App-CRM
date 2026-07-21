import { describe, it, expect } from "vitest";
import { calculateOrderTotals, formatPercent } from "../../../shared/restaurant-order-totals";

describe("calculateOrderTotals", () => {
  it("aplica a taxa de serviço padrão de 10% quando o percentual não vem", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "50.00", quantity: 2 }],
    });

    expect(totals.subtotal).toBe(100);
    expect(totals.serviceFeePercent).toBe(10);
    expect(totals.serviceFee).toBe(10);
    expect(totals.total).toBe(110);
    expect(totals.hasDiscount).toBe(false);
  });

  it("respeita o serviceFeePercent da comanda em vez de assumir 10%", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "100.00", quantity: 1 }],
      serviceFeePercent: "12.50",
    });

    expect(totals.serviceFee).toBe(12.5);
    expect(totals.total).toBe(112.5);
  });

  it("aceita taxa zerada (restaurante que não cobra serviço)", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "80.00", quantity: 1 }],
      serviceFeePercent: "0.00",
    });

    expect(totals.serviceFee).toBe(0);
    expect(totals.total).toBe(80);
  });

  it("aplica desconto em valor antes da taxa de serviço", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "100.00", quantity: 1 }],
      discountAmount: "20.00",
    });

    expect(totals.discountAmount).toBe(20);
    expect(totals.serviceFee).toBe(8); // 10% sobre 80, não sobre 100
    expect(totals.total).toBe(88);
  });

  it("aplica desconto percentual", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "200.00", quantity: 1 }],
      discountPercent: "15.00",
    });

    expect(totals.discountAmount).toBe(30);
    expect(totals.total).toBe(187);
  });

  it("limita o desconto ao subtotal — total nunca fica negativo", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "30.00", quantity: 1 }],
      discountAmount: "500.00",
    });

    expect(totals.discountAmount).toBe(30);
    expect(totals.total).toBe(0);
  });

  it("arredonda em centavos — sem resíduo de ponto flutuante", () => {
    const totals = calculateOrderTotals({
      items: [
        { unitPrice: "0.10", quantity: 3 },
        { unitPrice: "0.20", quantity: 1 },
      ],
    });

    expect(totals.subtotalCents).toBe(50);
    expect(totals.serviceFeeCents).toBe(5);
    expect(totals.totalCents).toBe(55);
    expect(totals.total).toBe(0.55);
  });

  it("arredonda a taxa de serviço para o centavo mais próximo", () => {
    const totals = calculateOrderTotals({
      items: [{ unitPrice: "33.33", quantity: 1 }],
    });

    // 3333 * 0.10 = 333.3 → 333 centavos
    expect(totals.serviceFeeCents).toBe(333);
    expect(totals.totalCents).toBe(3666);
  });

  it("comanda vazia zera tudo", () => {
    const totals = calculateOrderTotals({ items: [] });

    expect(totals.subtotal).toBe(0);
    expect(totals.serviceFee).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe("formatPercent", () => {
  it("formata inteiro sem decimais", () => {
    expect(formatPercent(10)).toBe("10%");
  });

  it("usa vírgula como separador decimal", () => {
    expect(formatPercent(12.5)).toBe("12,5%");
  });
});
