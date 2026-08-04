import { db } from "../db";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderPayments,
  users,
} from "../../shared/schema";
import { eq, and, gte, lte, inArray, isNotNull, desc } from "drizzle-orm";
import type { RestaurantOrder } from "../../shared/schema";
import { saoPauloDayRange } from "../../shared/sao-paulo-date";
import { fromCents } from "../../shared/restaurant-order-totals";
import {
  buildSalesAggregates,
  moneyToCents,
  percentChange,
  type SalesAggregates,
} from "../../shared/restaurant-sales-aggregates";
import {
  buildCancellationsReport,
  type CancellationsReport,
} from "../../shared/restaurant-cancellations";

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

export interface SalesReport extends SalesAggregates {
  byPaymentMethod: { method: string; total: number }[];
  byWaiter: { waiterId: string; waiterName: string; total: number; orderCount: number }[];
  comparison: SalesComparison;
}

export interface SalesComparison {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  revenueChangePct: number | null;
  orderCountChangePct: number | null;
  averageTicketChangePct: number | null;
}

/**
 * Comandas fechadas da unidade na janela.
 *
 * `unitId` é obrigatório: sem ele, todo relatório somava as vendas de TODAS as
 * unidades e o seletor de unidade não mudava nenhum número. Igualdade estrita
 * (sem fallback para NULL) segue o padrão de `restaurantPdvService.listOrders`.
 */
async function fetchClosedOrders(
  from: Date,
  to: Date,
  unitId: string,
): Promise<RestaurantOrder[]> {
  return db
    .select()
    .from(restaurantOrders)
    .where(
      and(
        eq(restaurantOrders.status, "fechada"),
        eq(restaurantOrders.unitId, unitId),
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

  const centsByMethod = new Map<string, number>();
  for (const p of payments) {
    centsByMethod.set(
      p.method,
      (centsByMethod.get(p.method) ?? 0) + moneyToCents(p.amount),
    );
  }
  return Array.from(centsByMethod.entries()).map(([method, cents]) => ({
    method,
    total: Number(fromCents(cents)),
  }));
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
    { waiterId: string; waiterName: string; cents: number; orderCount: number }
  >();
  for (const o of orders) {
    const existing = map.get(o.waiterId) ?? {
      waiterId: o.waiterId,
      waiterName: nameById.get(o.waiterId) ?? "—",
      cents: 0,
      orderCount: 0,
    };
    existing.cents += moneyToCents(o.total);
    existing.orderCount += 1;
    map.set(o.waiterId, existing);
  }
  return Array.from(map.values()).map(({ cents, ...rest }) => ({
    ...rest,
    total: Number(fromCents(cents)),
  }));
}

export const restaurantReportsService = {
  async getDailySummary(params: { date: string; unitId: string }): Promise<DailySummary> {
    const { from, to } = saoPauloDayRange(params.date);

    const orders = await fetchClosedOrders(from, to, params.unitId);
    const orderIds = orders.map((o) => o.id);

    const totalCents = orders.reduce((sum, o) => sum + moneyToCents(o.total), 0);
    const orderCount = orders.length;

    return {
      date: params.date,
      totalRevenue: Number(fromCents(totalCents)),
      orderCount,
      averageTicket:
        orderCount > 0 ? Number(fromCents(Math.round(totalCents / orderCount))) : 0,
      byPaymentMethod: await getPaymentMethodBreakdown(orderIds),
      byWaiter: await getWaiterBreakdown(orders),
    };
  },

  async getSalesReport(range: {
    from: Date;
    to: Date;
    unitId: string;
  }): Promise<SalesReport> {
    const orders = await fetchClosedOrders(range.from, range.to, range.unitId);
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

    const aggregates = buildSalesAggregates(orders, items, range);

    // Janela anterior de mesma duração, imediatamente antes de `from`. Só
    // total/contagem — sem itens nem pagamentos, para não dobrar o custo.
    const durationMs = range.to.getTime() - range.from.getTime();
    const prevOrders = await fetchClosedOrders(
      new Date(range.from.getTime() - durationMs - 1),
      new Date(range.from.getTime() - 1),
      range.unitId,
    );
    const prevTotalCents = prevOrders.reduce((sum, o) => sum + moneyToCents(o.total), 0);
    const prevCount = prevOrders.length;
    const prevAverageCents = prevCount > 0 ? Math.round(prevTotalCents / prevCount) : 0;
    const currentTotalCents = orders.reduce((sum, o) => sum + moneyToCents(o.total), 0);
    const currentAverageCents =
      orders.length > 0 ? Math.round(currentTotalCents / orders.length) : 0;

    return {
      ...aggregates,
      byPaymentMethod: await getPaymentMethodBreakdown(orderIds),
      byWaiter: await getWaiterBreakdown(orders),
      comparison: {
        totalRevenue: Number(fromCents(prevTotalCents)),
        orderCount: prevCount,
        averageTicket: Number(fromCents(prevAverageCents)),
        revenueChangePct: percentChange(currentTotalCents, prevTotalCents),
        orderCountChangePct: percentChange(orders.length, prevCount),
        averageTicketChangePct: percentChange(currentAverageCents, prevAverageCents),
      },
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
    /**
     * Obrigatório, mas aceita `null`: a sessão de caixa pode ser legada e não
     * ter unidade. Opcional deixaria esquecer o argumento reintroduzir o
     * vazamento entre unidades sem nenhum sinal do compilador.
     */
    unitId: string | null;
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
          ...(range.unitId ? [eq(restaurantOrders.unitId, range.unitId)] : []),
        ),
      )
      .orderBy(desc(restaurantOrderItems.cancelledAt))
      .limit(range.limit ?? 200);

    return rows;
  },

  /**
   * Relatório de cancelamentos do período.
   *
   * Roda a consulta SEM `limit` e trunca só na exibição: o total, o `itemCount`
   * e o ranking por operador precisam refletir o período inteiro. O que limita
   * o volume lido é o teto de janela validado no controller.
   *
   * Se um dia a contagem de linhas por janela típica passar de ~10k, trocar
   * por `SUM(...) GROUP BY cancelled_by` em SQL — `numeric` no Postgres é
   * exato, então a agregação continuaria correta em centavos.
   */
  async getCancellationsReport(range: {
    from: Date;
    to: Date;
    unitId: string | null;
    detailLimit?: number;
  }): Promise<CancellationsReport<CancelledItemRow>> {
    const detailLimit = range.detailLimit ?? 200;
    const rows = await this.listCancelledItems({
      from: range.from,
      to: range.to,
      unitId: range.unitId,
      limit: Number.MAX_SAFE_INTEGER,
    });

    return buildCancellationsReport(rows, detailLimit);
  },
};
