import { db } from "../db";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderPayments,
  users,
} from "../../shared/schema";
import { eq, and, gte, lte, inArray, isNotNull, desc } from "drizzle-orm";
import type { RestaurantOrder } from "../../shared/schema";

export interface CancelledItemRow {
  itemId: string;
  itemName: string;
  unitPrice: string;
  quantity: number;
  orderNumber: number;
  tableNumber: number;
  orderStatus: string;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledByName: string | null;
  cancelledAt: Date | null;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  byPaymentMethod: { method: string; total: number }[];
  byWaiter: { waiterId: string; waiterName: string; total: number; orderCount: number }[];
}

export interface SalesReport {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  byHour: { hour: number; orderCount: number; revenue: number }[];
  dailySeries: { date: string; orderCount: number; revenue: number }[];
  byPaymentMethod: { method: string; total: number }[];
  byWaiter: { waiterId: string; waiterName: string; total: number; orderCount: number }[];
}

// America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019)
const SP_OFFSET_HOURS = 3;

async function fetchClosedOrders(from: Date, to: Date): Promise<RestaurantOrder[]> {
  return db
    .select()
    .from(restaurantOrders)
    .where(
      and(
        eq(restaurantOrders.status, "fechada"),
        gte(restaurantOrders.closedAt, from),
        lte(restaurantOrders.closedAt, to),
      ),
    );
}

async function getPaymentMethodBreakdown(
  orderIds: string[],
): Promise<{ method: string; total: number }[]> {
  const payments =
    orderIds.length > 0
      ? await db
          .select()
          .from(restaurantOrderPayments)
          .where(inArray(restaurantOrderPayments.orderId, orderIds))
      : [];

  const map = new Map<string, number>();
  for (const p of payments) {
    map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount));
  }
  return Array.from(map.entries()).map(([method, total]) => ({ method, total }));
}

async function getWaiterBreakdown(
  orders: RestaurantOrder[],
): Promise<{ waiterId: string; waiterName: string; total: number; orderCount: number }[]> {
  const waiterIds = Array.from(new Set(orders.map((o) => o.waiterId)));
  const waiters =
    waiterIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, waiterIds))
      : [];
  const nameById = new Map(waiters.map((w) => [w.id, w.name]));

  const map = new Map<
    string,
    { waiterId: string; waiterName: string; total: number; orderCount: number }
  >();
  for (const o of orders) {
    const existing = map.get(o.waiterId) ?? {
      waiterId: o.waiterId,
      waiterName: nameById.get(o.waiterId) ?? "—",
      total: 0,
      orderCount: 0,
    };
    existing.total += Number(o.total ?? 0);
    existing.orderCount += 1;
    map.set(o.waiterId, existing);
  }
  return Array.from(map.values());
}

export const restaurantReportsService = {
  async getDailySummary(date: string): Promise<DailySummary> {
    const start = new Date(`${date}T00:00:00-03:00`);
    const end = new Date(`${date}T23:59:59.999-03:00`);

    const orders = await fetchClosedOrders(start, end);
    const orderIds = orders.map((o) => o.id);

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const orderCount = orders.length;
    const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      date,
      totalRevenue,
      orderCount,
      averageTicket,
      byPaymentMethod: await getPaymentMethodBreakdown(orderIds),
      byWaiter: await getWaiterBreakdown(orders),
    };
  },

  async getSalesReport(range: { from: Date; to: Date }): Promise<SalesReport> {
    const orders = await fetchClosedOrders(range.from, range.to);
    const orderIds = orders.map((o) => o.id);

    const items =
      orderIds.length > 0
        ? await db
            .select()
            .from(restaurantOrderItems)
            .where(
              and(
                inArray(restaurantOrderItems.orderId, orderIds),
                eq(restaurantOrderItems.status, "ativo"),
              ),
            )
        : [];

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const orderCount = orders.length;
    const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0;

    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const it of items) {
      const existing = itemMap.get(it.name) ?? { name: it.name, quantity: 0, revenue: 0 };
      existing.quantity += it.quantity;
      existing.revenue += Number(it.unitPrice) * it.quantity;
      itemMap.set(it.name, existing);
    }
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const hourMap = new Map<number, { hour: number; orderCount: number; revenue: number }>();
    const dayMap = new Map<string, { date: string; orderCount: number; revenue: number }>();
    for (const o of orders) {
      if (!o.closedAt) continue;
      const closedAt = new Date(o.closedAt);
      const spDate = new Date(closedAt.getTime() - SP_OFFSET_HOURS * 60 * 60 * 1000);
      const spHour = spDate.getUTCHours();
      const dateKey = spDate.toISOString().slice(0, 10);

      const hourEntry = hourMap.get(spHour) ?? { hour: spHour, orderCount: 0, revenue: 0 };
      hourEntry.orderCount += 1;
      hourEntry.revenue += Number(o.total ?? 0);
      hourMap.set(spHour, hourEntry);

      const dayEntry = dayMap.get(dateKey) ?? { date: dateKey, orderCount: 0, revenue: 0 };
      dayEntry.orderCount += 1;
      dayEntry.revenue += Number(o.total ?? 0);
      dayMap.set(dateKey, dayEntry);
    }

    return {
      totalRevenue,
      orderCount,
      averageTicket,
      topItems,
      byHour: Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour),
      dailySeries: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      byPaymentMethod: await getPaymentMethodBreakdown(orderIds),
      byWaiter: await getWaiterBreakdown(orders),
    };
  },

  /**
   * Itens cancelados numa janela de tempo, do mais recente para o mais antigo.
   *
   * O recorte é por `cancelled_at`, não pela sessão de caixa da comanda: o item
   * pode ser cancelado numa comanda que ainda está aberta e que só vai fechar
   * (e ganhar `cash_session_id`) depois. A pergunta operacional é "o que foi
   * cancelado durante este turno", e quem responde isso é a hora do
   * cancelamento.
   *
   * Serve tanto o caixa (janela da sessão) quanto os relatórios (período
   * escolhido) — mesma query, recortes diferentes.
   */
  async listCancelledItems(range: {
    from: Date;
    to: Date;
    limit?: number;
  }): Promise<CancelledItemRow[]> {
    const rows = await db
      .select({
        itemId: restaurantOrderItems.id,
        itemName: restaurantOrderItems.name,
        unitPrice: restaurantOrderItems.unitPrice,
        quantity: restaurantOrderItems.quantity,
        orderNumber: restaurantOrders.orderNumber,
        tableNumber: restaurantOrders.tableNumber,
        orderStatus: restaurantOrders.status,
        cancelReason: restaurantOrderItems.cancelReason,
        cancelledById: restaurantOrderItems.cancelledBy,
        cancelledByName: users.name,
        cancelledAt: restaurantOrderItems.cancelledAt,
      })
      .from(restaurantOrderItems)
      .innerJoin(restaurantOrders, eq(restaurantOrders.id, restaurantOrderItems.orderId))
      .leftJoin(users, eq(users.id, restaurantOrderItems.cancelledBy))
      .where(
        and(
          eq(restaurantOrderItems.status, "cancelado"),
          isNotNull(restaurantOrderItems.cancelledAt),
          gte(restaurantOrderItems.cancelledAt, range.from),
          lte(restaurantOrderItems.cancelledAt, range.to),
        ),
      )
      .orderBy(desc(restaurantOrderItems.cancelledAt))
      .limit(range.limit ?? 200);

    return rows;
  },
};
