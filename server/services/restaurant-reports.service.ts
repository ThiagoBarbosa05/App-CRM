import { db } from "../db";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderPayments,
  users,
} from "../../shared/schema";
import { eq, and, gte, lte, inArray, isNotNull, desc } from "drizzle-orm";
import type { RestaurantOrder } from "../../shared/schema";
import { eachDayOfInterval, format as formatDate, parseISO } from "date-fns";
import { saoPauloDayRange } from "../../shared/sao-paulo-date";
import { fromCents, toCents } from "../../shared/restaurant-order-totals";
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

/** Dia civil de São Paulo de um instante, `YYYY-MM-DD`. */
function saoPauloDateKey(instant: Date): string {
  return new Date(instant.getTime() - SP_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Centavos de uma coluna monetária que pode ser nula.
 *
 * `toCents` recusa null/vazio de propósito — para o fechamento de comanda,
 * valor ausente é erro, não zero. Mas `restaurant_orders.total` só é gravado
 * no fechamento, então relatório é justamente onde a coluna nula aparece; sem
 * esta guarda, uma linha legada derrubaria o relatório inteiro em 500.
 */
function moneyToCents(value: string | null | undefined): number {
  return value ? toCents(value) : 0;
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

    const totalCents = orders.reduce((sum, o) => sum + moneyToCents(o.total), 0);
    const orderCount = orders.length;

    const itemMap = new Map<string, { name: string; quantity: number; cents: number }>();
    for (const it of items) {
      const existing = itemMap.get(it.name) ?? { name: it.name, quantity: 0, cents: 0 };
      existing.quantity += it.quantity;
      existing.cents += moneyToCents(it.unitPrice) * it.quantity;
      itemMap.set(it.name, existing);
    }
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(({ cents, ...rest }) => ({ ...rest, revenue: Number(fromCents(cents)) }));

    const hourMap = new Map<number, { orderCount: number; cents: number }>();
    const dayMap = new Map<string, { orderCount: number; cents: number }>();
    for (const o of orders) {
      if (!o.closedAt) continue;
      const closedAt = new Date(o.closedAt);
      const spHour = new Date(
        closedAt.getTime() - SP_OFFSET_HOURS * 60 * 60 * 1000,
      ).getUTCHours();
      const dateKey = saoPauloDateKey(closedAt);
      const cents = moneyToCents(o.total);

      const hourEntry = hourMap.get(spHour) ?? { orderCount: 0, cents: 0 };
      hourEntry.orderCount += 1;
      hourEntry.cents += cents;
      hourMap.set(spHour, hourEntry);

      const dayEntry = dayMap.get(dateKey) ?? { orderCount: 0, cents: 0 };
      dayEntry.orderCount += 1;
      dayEntry.cents += cents;
      dayMap.set(dateKey, dayEntry);
    }

    // Dia sem venda precisa aparecer zerado: omitir a chave fazia a linha do
    // gráfico ligar 02/08 direto em 04/08, escondendo a queda de 03/08.
    // A chave vem do mesmo `saoPauloDateKey` do laço acima — gerar de outro
    // jeito produziria dias duplicados no eixo.
    const dailySeries = eachDayOfInterval({
      start: parseISO(saoPauloDateKey(range.from)),
      end: parseISO(saoPauloDateKey(range.to)),
    }).map((day) => {
      const dateKey = formatDate(day, "yyyy-MM-dd");
      const entry = dayMap.get(dateKey);
      return {
        date: dateKey,
        orderCount: entry?.orderCount ?? 0,
        revenue: Number(fromCents(entry?.cents ?? 0)),
      };
    });

    return {
      totalRevenue: Number(fromCents(totalCents)),
      orderCount,
      averageTicket:
        orderCount > 0 ? Number(fromCents(Math.round(totalCents / orderCount))) : 0,
      topItems,
      // `byHour` fica só com as horas observadas de propósito: preencher 0-23
      // daria 18 barras vazias num restaurante que abre às 18h.
      byHour: Array.from(hourMap.entries())
        .map(([hour, entry]) => ({
          hour,
          orderCount: entry.orderCount,
          revenue: Number(fromCents(entry.cents)),
        }))
        .sort((a, b) => a.hour - b.hour),
      dailySeries,
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
