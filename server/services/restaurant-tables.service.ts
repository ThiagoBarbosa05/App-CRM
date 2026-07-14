import { db } from "../db";
import { restaurantTables, restaurantOrders } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { RestaurantTable, InsertRestaurantTable } from "../../shared/schema";

export type TableStatus = "livre" | "ocupada" | "aguardando_pagamento";

export interface RestaurantTableWithStatus extends RestaurantTable {
  status: TableStatus;
  orderId: string | null;
  peopleCount: number | null;
  openedAt: Date | null;
  waiterId: string | null;
}

export const restaurantTablesService = {
  async listTables(includeInactive = false): Promise<RestaurantTable[]> {
    return db
      .select()
      .from(restaurantTables)
      .where(includeInactive ? undefined : eq(restaurantTables.isActive, true))
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

  async listTablesWithStatus(): Promise<RestaurantTableWithStatus[]> {
    const rows = await db
      .select({
        table: restaurantTables,
        orderId: restaurantOrders.id,
        paymentRequestedAt: restaurantOrders.paymentRequestedAt,
        peopleCount: restaurantOrders.peopleCount,
        openedAt: restaurantOrders.openedAt,
        waiterId: restaurantOrders.waiterId,
      })
      .from(restaurantTables)
      .leftJoin(
        restaurantOrders,
        and(
          eq(restaurantOrders.tableId, restaurantTables.id),
          eq(restaurantOrders.status, "aberta"),
        ),
      )
      .where(eq(restaurantTables.isActive, true))
      .orderBy(restaurantTables.number);

    return rows.map((row) => ({
      ...row.table,
      status: !row.orderId
        ? "livre"
        : row.paymentRequestedAt
          ? "aguardando_pagamento"
          : "ocupada",
      orderId: row.orderId ?? null,
      peopleCount: row.peopleCount ?? null,
      openedAt: row.openedAt ?? null,
      waiterId: row.waiterId ?? null,
    }));
  },
};
