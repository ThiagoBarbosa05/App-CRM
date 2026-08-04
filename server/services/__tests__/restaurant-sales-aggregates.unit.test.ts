import { describe, it, expect } from "vitest";
import {
  buildSalesAggregates,
  percentChange,
} from "../../../shared/restaurant-sales-aggregates";
import type { RestaurantOrder } from "../../../shared/schema";

// Só os campos que a agregação lê; o resto do RestaurantOrder é irrelevante
// para a lógica pura, então o cast é seguro dentro do teste.
function makeOrder(overrides: Partial<RestaurantOrder>): RestaurantOrder {
  return {
    total: "100.00",
    serviceFeeAmount: null,
    discountAmount: null,
    discountReason: null,
    peopleCount: null,
    tableNumber: 1,
    // 15h UTC = 12h em São Paulo, num sábado (2026-08-01)
    openedAt: new Date("2026-08-01T14:00:00Z"),
    closedAt: new Date("2026-08-01T15:00:00Z"),
    ...overrides,
  } as RestaurantOrder;
}

const range = {
  from: new Date("2026-08-01T03:00:00Z"),
  to: new Date("2026-08-08T02:59:59Z"),
};

describe("percentChange", () => {
  it("retorna null quando a base é zero (sem referência de comparação)", () => {
    expect(percentChange(100, 0)).toBeNull();
  });

  it("calcula variação positiva e negativa", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });
});

describe("buildSalesAggregates", () => {
  it("soma taxa de serviço e agrupa descontos por motivo, tratando motivo vazio", () => {
    const result = buildSalesAggregates(
      [
        makeOrder({ serviceFeeAmount: "10.00", discountAmount: "5.00", discountReason: "Aniversário" }),
        makeOrder({ serviceFeeAmount: "8.00", discountAmount: "3.00", discountReason: "Aniversário" }),
        makeOrder({ discountAmount: "2.00", discountReason: "  " }),
        makeOrder({}),
      ],
      [],
      range,
    );

    expect(result.serviceFeeTotal).toBe(18);
    expect(result.discounts.total).toBe(10);
    expect(result.discounts.orderCount).toBe(3);
    expect(result.discounts.byReason).toEqual([
      { reason: "Aniversário", total: 8, count: 2 },
      { reason: "Sem motivo", total: 2, count: 1 },
    ]);
  });

  it("ticket por pessoa considera só comandas com peopleCount > 0; null quando não há nenhuma", () => {
    const withPeople = buildSalesAggregates(
      [
        makeOrder({ total: "90.00", peopleCount: 3 }),
        makeOrder({ total: "50.00", peopleCount: 0 }),
        makeOrder({ total: "40.00" }), // sem peopleCount (default null da fixture)
      ],
      [],
      range,
    );
    // 90.00 / 3 pessoas — as comandas sem peopleCount ficam fora do numerador e do denominador
    expect(withPeople.averageTicketPerPerson).toBe(30);

    const noPeople = buildSalesAggregates([makeOrder({})], [], range);
    expect(noPeople.averageTicketPerPerson).toBeNull();
  });

  it("permanência média ignora comandas sem closedAt e retorna null sem amostras", () => {
    const result = buildSalesAggregates(
      [
        makeOrder({
          openedAt: new Date("2026-08-01T14:00:00Z"),
          closedAt: new Date("2026-08-01T15:30:00Z"),
        }),
        makeOrder({
          openedAt: new Date("2026-08-01T14:00:00Z"),
          closedAt: new Date("2026-08-01T14:30:00Z"),
        }),
        makeOrder({ closedAt: null }),
      ],
      [],
      range,
    );
    expect(result.averageStayMinutes).toBe(60);

    const none = buildSalesAggregates([makeOrder({ closedAt: null })], [], range);
    expect(none.averageStayMinutes).toBeNull();
  });

  it("faixas de valor são semiabertas: R$ 50,00 exatos caem em 50-100", () => {
    const result = buildSalesAggregates(
      [
        makeOrder({ total: "49.99" }),
        makeOrder({ total: "50.00" }),
        makeOrder({ total: "500.00" }),
      ],
      [],
      range,
    );
    expect(result.ticketDistribution).toEqual([
      { bucket: "0-50", orderCount: 1 },
      { bucket: "50-100", orderCount: 1 },
      { bucket: "100-200", orderCount: 0 },
      { bucket: "200-500", orderCount: 0 },
      { bucket: "500+", orderCount: 1 },
    ]);
  });

  it("dia da semana usa o fuso de São Paulo na virada do dia", () => {
    // 2026-08-02 01:00 UTC ainda é sábado (2026-08-01) 22h em São Paulo
    const result = buildSalesAggregates(
      [makeOrder({ closedAt: new Date("2026-08-02T01:00:00Z") })],
      [],
      range,
    );
    expect(result.byWeekday).toEqual([{ weekday: 6, orderCount: 1, revenue: 100 }]);
    expect(result.byHour).toEqual([{ hour: 22, orderCount: 1, revenue: 100 }]);
  });

  it("agrupa vendas por mesa ordenando por receita", () => {
    const result = buildSalesAggregates(
      [
        makeOrder({ tableNumber: 5, total: "30.00" }),
        makeOrder({ tableNumber: 2, total: "200.00" }),
        makeOrder({ tableNumber: 5, total: "40.00" }),
      ],
      [],
      range,
    );
    expect(result.byTable).toEqual([
      { tableNumber: 2, orderCount: 1, revenue: 200 },
      { tableNumber: 5, orderCount: 2, revenue: 70 },
    ]);
  });
});
