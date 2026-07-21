import { db } from "../db";
import { restaurantTables, restaurantOrders } from "../../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
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
    const [rows, avulsaOrders] = await Promise.all([
      db
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
        .orderBy(restaurantTables.number),

      // Ordens avulsas: abertas sem mesa cadastrada
      db
        .select({
          id: restaurantOrders.id,
          tableNumber: restaurantOrders.tableNumber,
          paymentRequestedAt: restaurantOrders.paymentRequestedAt,
          peopleCount: restaurantOrders.peopleCount,
          openedAt: restaurantOrders.openedAt,
          waiterId: restaurantOrders.waiterId,
        })
        .from(restaurantOrders)
        .where(
          and(
            isNull(restaurantOrders.tableId),
            eq(restaurantOrders.status, "aberta"),
          ),
        )
        .orderBy(restaurantOrders.tableNumber),
    ]);

    const registeredTables: RestaurantTableWithStatus[] = rows.map((row) => ({
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

    // Monta entradas virtuais para mesas avulsas
    const avulsaTables: RestaurantTableWithStatus[] = avulsaOrders.map((o) => ({
      id: `avulsa-${o.id}`,
      number: o.tableNumber,
      capacity: o.peopleCount ?? 0,
      section: "Avulsas",
      isActive: true,
      createdAt: o.openedAt ?? new Date(),
      updatedAt: o.openedAt ?? new Date(),
      status: o.paymentRequestedAt ? "aguardando_pagamento" : "ocupada",
      orderId: o.id,
      peopleCount: o.peopleCount ?? null,
      openedAt: o.openedAt ?? null,
      waiterId: o.waiterId ?? null,
    }));

    return [...registeredTables, ...avulsaTables];
  },
};
