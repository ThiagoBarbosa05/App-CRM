import { db } from "../db";
import { restaurantTables, restaurantOrders } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { RestaurantTable, InsertRestaurantTable } from "../../shared/schema";

export type TableStatus = "livre" | "ocupada" | "aguardando_pagamento";

export interface RestaurantTableWithStatus extends RestaurantTable {
  status: TableStatus;
  tableId: string | null;
  orderId: string | null;
  peopleCount: number | null;
  openedAt: Date | null;
  waiterId: string | null;
}

export const restaurantTablesService = {
  async listTables(includeInactive = false, unitId?: string): Promise<RestaurantTable[]> {
    const conditions = [
      includeInactive ? undefined : eq(restaurantTables.isActive, true),
      unitId ? eq(restaurantTables.unitId, unitId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return db
      .select()
      .from(restaurantTables)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(restaurantTables.number);
  },

  async createTable(data: InsertRestaurantTable): Promise<RestaurantTable> {
    const [created] = await db.insert(restaurantTables).values(data).returning();
    return created;
  },

  async updateTable(
    id: string,
    data: Partial<InsertRestaurantTable>,
  ): Promise<RestaurantTable | null> {
    const [updated] = await db
      .update(restaurantTables)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(restaurantTables.id, id))
      .returning();
    return updated ?? null;
  },

  async deactivateTable(id: string): Promise<void> {
    const [openOrder] = await db
      .select({ id: restaurantOrders.id })
      .from(restaurantOrders)
      .where(and(eq(restaurantOrders.tableId, id), eq(restaurantOrders.status, "aberta")))
      .limit(1);

    if (openOrder) {
      throw Object.assign(
        new Error("Não é possível desativar uma mesa com comanda aberta"),
        { code: "TABLE_HAS_OPEN_ORDER" },
      );
    }

    await db
      .update(restaurantTables)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(restaurantTables.id, id));
  },

  async listTablesWithStatus(unitId?: string): Promise<RestaurantTableWithStatus[]> {
    const conditions = [
      eq(restaurantOrders.status, "aberta"),
      unitId ? eq(restaurantOrders.unitId, unitId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const orders = await db
      .select({
        id: restaurantOrders.id,
        tableId: restaurantOrders.tableId,
        tableNumber: restaurantOrders.tableNumber,
        paymentRequestedAt: restaurantOrders.paymentRequestedAt,
        peopleCount: restaurantOrders.peopleCount,
        openedAt: restaurantOrders.openedAt,
        waiterId: restaurantOrders.waiterId,
      })
      .from(restaurantOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(restaurantOrders.tableNumber);

    return orders.map((o) => ({
      id: o.id,
      tableId: o.tableId,
      number: o.tableNumber,
      capacity: o.peopleCount ?? 0,
      section: null,
      isActive: true,
      unitId: null,
      createdBy: o.waiterId,
      createdAt: o.openedAt ?? new Date(),
      updatedAt: o.openedAt ?? new Date(),
      status: (o.paymentRequestedAt ? "aguardando_pagamento" : "ocupada") as RestaurantTableWithStatus["status"],
      orderId: o.id,
      peopleCount: o.peopleCount ?? null,
      openedAt: o.openedAt ?? null,
      waiterId: o.waiterId ?? null,
    }));
  },
};
