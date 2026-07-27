import { describe, expect, it } from "vitest";
import {
  resolveBlingSalesOrderPayload,
  type ResolveBlingSalesOrderInput,
} from "../bling-sales-order.service";
import type { RestaurantOrder, RestaurantOrderItem } from "../../../shared/schema";

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
    blingSyncError: null,
    blingSyncAttempts: 0,
    blingSyncAttemptedAt: null,
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
