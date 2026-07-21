import { db } from "../db";
import { restaurantTables, restaurantOrders } from "../../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { RestaurantTable, InsertRestaurantTable } from "../../shared/schema";

export type TableStatus = "livre" | "ocupada" | "aguardando_pagamento";

export interface RestaurantTableWithStatus extends RestaurantTable {
  status: TableStatus;
  /** Mesa cadastrada de origem, quando houver. Null em mesa avulsa. */
  tableId: string | null;
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

  /**
   * Todas as comandas abertas — inclusive as vinculadas a mesas cadastradas.
   *
   * Antes filtrava `table_id IS NULL`, listando só mesas avulsas. Comandas de
   * mesas cadastradas ficavam invisíveis no mapa, mas continuavam bloqueando a
   * reabertura da mesa (a checagem de duplicata olha só `table_number`) e
   * impedindo o fechamento do caixa. Mesa fantasma: ninguém via, ninguém
   * conseguia fechar.
   */
  async listTablesWithStatus(): Promise<RestaurantTableWithStatus[]> {
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
      .where(eq(restaurantOrders.status, "aberta"))
      .orderBy(restaurantOrders.tableNumber);

    return orders.map((o) => ({
      // A identidade da linha é a COMANDA, não a mesa: é o que os diálogos de
      // transferir/juntar precisam comparar para excluir a mesa atual.
      id: o.id,
      tableId: o.tableId,
      number: o.tableNumber,
      capacity: o.peopleCount ?? 0,
      section: null,
      isActive: true,
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
