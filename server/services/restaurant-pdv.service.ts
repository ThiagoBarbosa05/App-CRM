import { db } from "../db";
import {
  restaurantMenuItems,
  restaurantOrders,
  restaurantOrderItems,
} from "../../shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import type {
  RestaurantMenuItem,
  InsertRestaurantMenuItem,
  RestaurantOrder,
  RestaurantOrderItem,
} from "../../shared/schema";

export interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export const restaurantPdvService = {
  async listMenuItems(activeOnly = true): Promise<RestaurantMenuItem[]> {
    return db
      .select()
      .from(restaurantMenuItems)
      .where(activeOnly ? eq(restaurantMenuItems.isActive, true) : undefined)
      .orderBy(restaurantMenuItems.category, restaurantMenuItems.name);
  },

  async createMenuItem(
    data: InsertRestaurantMenuItem,
  ): Promise<RestaurantMenuItem> {
    const [created] = await db
      .insert(restaurantMenuItems)
      .values(data)
      .returning();
    return created;
  },

  async updateMenuItem(
    id: string,
    data: Partial<InsertRestaurantMenuItem>,
  ): Promise<RestaurantMenuItem | null> {
    const [updated] = await db
      .update(restaurantMenuItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(restaurantMenuItems.id, id))
      .returning();
    return updated ?? null;
  },

  async deactivateMenuItem(id: string): Promise<void> {
    await db
      .update(restaurantMenuItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(restaurantMenuItems.id, id));
  },

  async openOrder(data: {
    tableNumber: number;
    peopleCount: number;
    waiterId: string;
  }): Promise<RestaurantOrder> {
    const [created] = await db
      .insert(restaurantOrders)
      .values({
        tableNumber: data.tableNumber,
        peopleCount: data.peopleCount,
        waiterId: data.waiterId,
      })
      .returning();
    return created;
  },

  async getOrderWithItems(
    orderId: string,
  ): Promise<RestaurantOrderWithItems | null> {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order) return null;

    const items = await db
      .select()
      .from(restaurantOrderItems)
      .where(eq(restaurantOrderItems.orderId, orderId))
      .orderBy(restaurantOrderItems.createdAt);

    return { ...order, items };
  },

  async listOrders(filters: {
    status?: "aberta" | "fechada";
    waiterId?: string;
    from?: Date;
    to?: Date;
  }): Promise<RestaurantOrder[]> {
    const conditions = [
      filters.status ? eq(restaurantOrders.status, filters.status) : undefined,
      filters.waiterId ? eq(restaurantOrders.waiterId, filters.waiterId) : undefined,
      filters.from ? gte(restaurantOrders.openedAt, filters.from) : undefined,
      filters.to ? lte(restaurantOrders.openedAt, filters.to) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return db
      .select()
      .from(restaurantOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(restaurantOrders.openedAt));
  },

  async addItem(
    orderId: string,
    data: {
      menuItemId?: string | null;
      name: string;
      unitPrice: string;
      quantity: number;
    },
  ): Promise<RestaurantOrderItem> {
    await this.assertOrderOpen(orderId);

    const [created] = await db
      .insert(restaurantOrderItems)
      .values({
        orderId,
        menuItemId: data.menuItemId ?? null,
        name: data.name,
        unitPrice: data.unitPrice,
        quantity: data.quantity,
      })
      .returning();
    return created;
  },

  async updateItem(
    orderId: string,
    itemId: string,
    data: { unitPrice?: string; quantity?: number },
  ): Promise<RestaurantOrderItem | null> {
    await this.assertOrderOpen(orderId);

    const [updated] = await db
      .update(restaurantOrderItems)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(restaurantOrderItems.id, itemId),
          eq(restaurantOrderItems.orderId, orderId),
        ),
      )
      .returning();
    return updated ?? null;
  },

  async removeItem(orderId: string, itemId: string): Promise<void> {
    await this.assertOrderOpen(orderId);

    await db
      .delete(restaurantOrderItems)
      .where(
        and(
          eq(restaurantOrderItems.id, itemId),
          eq(restaurantOrderItems.orderId, orderId),
        ),
      );
  },

  async closeOrder(
    orderId: string,
    paymentMethod: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro",
  ): Promise<RestaurantOrder> {
    const order = await this.assertOrderOpen(orderId);

    const items = await db
      .select()
      .from(restaurantOrderItems)
      .where(eq(restaurantOrderItems.orderId, orderId));

    if (items.length === 0) {
      throw Object.assign(new Error("Não é possível fechar uma comanda sem itens"), {
        code: "NO_ITEMS",
      });
    }

    const subtotalCents = items.reduce(
      (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
      0,
    );
    const serviceFeePercent = Number(order.serviceFeePercent);
    const serviceFeeCents = Math.round(subtotalCents * (serviceFeePercent / 100));
    const totalCents = subtotalCents + serviceFeeCents;

    const [closed] = await db
      .update(restaurantOrders)
      .set({
        status: "fechada",
        paymentMethod,
        subtotal: fromCents(subtotalCents),
        serviceFeeAmount: fromCents(serviceFeeCents),
        total: fromCents(totalCents),
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(restaurantOrders.id, orderId))
      .returning();

    return closed;
  },

  async assertOrderOpen(orderId: string): Promise<RestaurantOrder> {
    const [order] = await db
      .select()
      .from(restaurantOrders)
      .where(eq(restaurantOrders.id, orderId))
      .limit(1);

    if (!order) {
      throw Object.assign(new Error("Comanda não encontrada"), {
        code: "NOT_FOUND",
      });
    }
    if (order.status !== "aberta") {
      throw Object.assign(new Error("Esta comanda já foi fechada"), {
        code: "ORDER_CLOSED",
      });
    }
    return order;
  },
};
