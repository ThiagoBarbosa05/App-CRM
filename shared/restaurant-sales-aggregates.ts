import { eachDayOfInterval, format as formatDate, parseISO } from "date-fns";
import { fromCents, toCents } from "./restaurant-order-totals";
import type { RestaurantOrder } from "./schema";

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
export function moneyToCents(value: string | null | undefined): number {
  return value ? toCents(value) : 0;
}

/** Variação percentual em relação à base; `null` quando a base é 0 (sem referência). */
export function percentChange(current: number, base: number): number | null {
  if (base === 0) return null;
  return ((current - base) / base) * 100;
}

// Faixas em centavos, semiabertas [min, max): R$ 50,00 exatos cai em "50-100".
const TICKET_BUCKETS: { label: string; minCents: number; maxCents: number }[] = [
  { label: "0-50", minCents: 0, maxCents: 5000 },
  { label: "50-100", minCents: 5000, maxCents: 10000 },
  { label: "100-200", minCents: 10000, maxCents: 20000 },
  { label: "200-500", minCents: 20000, maxCents: 50000 },
  { label: "500+", minCents: 50000, maxCents: Number.POSITIVE_INFINITY },
];

export interface SalesAggregates {
  totalRevenue: number;
  orderCount: number;
  averageTicket: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  byHour: { hour: number; orderCount: number; revenue: number }[];
  dailySeries: { date: string; orderCount: number; revenue: number }[];
  serviceFeeTotal: number;
  discounts: {
    total: number;
    orderCount: number;
    byReason: { reason: string; total: number; count: number }[];
  };
  averageTicketPerPerson: number | null;
  averageStayMinutes: number | null;
  byTable: { tableNumber: number; orderCount: number; revenue: number }[];
  byWeekday: { weekday: number; orderCount: number; revenue: number }[];
  ticketDistribution: { bucket: string; orderCount: number }[];
}

/**
 * Agregação em memória do relatório de vendas — pura de propósito, para ser
 * testável sem banco (mesmo padrão de `buildSellerQueues`). Recebe as comandas
 * fechadas do período e seus itens ativos; tudo que precisa de I/O extra
 * (pagamentos, nomes de garçom, período anterior) fica no
 * `restaurantReportsService.getSalesReport`.
 */
export function buildSalesAggregates(
  orders: RestaurantOrder[],
  items: { name: string; quantity: number; unitPrice: string | null }[],
  range: { from: Date; to: Date },
): SalesAggregates {
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
  const tableMap = new Map<number, { orderCount: number; cents: number }>();
  const weekdayMap = new Map<number, { orderCount: number; cents: number }>();
  const reasonMap = new Map<string, { cents: number; count: number }>();
  const bucketCounts = new Map<string, number>(TICKET_BUCKETS.map((b) => [b.label, 0]));

  let serviceFeeCents = 0;
  let discountCents = 0;
  let discountOrderCount = 0;
  let peopleSum = 0;
  let peopleTotalCents = 0;
  let staySumMinutes = 0;
  let stayCount = 0;

  for (const o of orders) {
    const cents = moneyToCents(o.total);

    serviceFeeCents += moneyToCents(o.serviceFeeAmount);

    const orderDiscountCents = moneyToCents(o.discountAmount);
    if (orderDiscountCents > 0) {
      discountCents += orderDiscountCents;
      discountOrderCount += 1;
      const reason = o.discountReason?.trim() || "Sem motivo";
      const entry = reasonMap.get(reason) ?? { cents: 0, count: 0 };
      entry.cents += orderDiscountCents;
      entry.count += 1;
      reasonMap.set(reason, entry);
    }

    if (o.peopleCount && o.peopleCount > 0) {
      peopleSum += o.peopleCount;
      peopleTotalCents += cents;
    }

    const tableEntry = tableMap.get(o.tableNumber) ?? { orderCount: 0, cents: 0 };
    tableEntry.orderCount += 1;
    tableEntry.cents += cents;
    tableMap.set(o.tableNumber, tableEntry);

    const bucket = TICKET_BUCKETS.find((b) => cents >= b.minCents && cents < b.maxCents);
    if (bucket) bucketCounts.set(bucket.label, (bucketCounts.get(bucket.label) ?? 0) + 1);

    if (!o.closedAt) continue;
    const closedAt = new Date(o.closedAt);
    const spInstant = new Date(closedAt.getTime() - SP_OFFSET_HOURS * 60 * 60 * 1000);
    const spHour = spInstant.getUTCHours();
    const dateKey = saoPauloDateKey(closedAt);

    const hourEntry = hourMap.get(spHour) ?? { orderCount: 0, cents: 0 };
    hourEntry.orderCount += 1;
    hourEntry.cents += cents;
    hourMap.set(spHour, hourEntry);

    const dayEntry = dayMap.get(dateKey) ?? { orderCount: 0, cents: 0 };
    dayEntry.orderCount += 1;
    dayEntry.cents += cents;
    dayMap.set(dateKey, dayEntry);

    const weekday = spInstant.getUTCDay();
    const weekdayEntry = weekdayMap.get(weekday) ?? { orderCount: 0, cents: 0 };
    weekdayEntry.orderCount += 1;
    weekdayEntry.cents += cents;
    weekdayMap.set(weekday, weekdayEntry);

    if (o.openedAt) {
      const stayMs = closedAt.getTime() - new Date(o.openedAt).getTime();
      if (stayMs >= 0) {
        staySumMinutes += stayMs / 60_000;
        stayCount += 1;
      }
    }
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
    serviceFeeTotal: Number(fromCents(serviceFeeCents)),
    discounts: {
      total: Number(fromCents(discountCents)),
      orderCount: discountOrderCount,
      byReason: Array.from(reasonMap.entries())
        .map(([reason, entry]) => ({
          reason,
          total: Number(fromCents(entry.cents)),
          count: entry.count,
        }))
        .sort((a, b) => b.total - a.total),
    },
    averageTicketPerPerson:
      peopleSum > 0 ? Number(fromCents(Math.round(peopleTotalCents / peopleSum))) : null,
    averageStayMinutes: stayCount > 0 ? Math.round(staySumMinutes / stayCount) : null,
    byTable: Array.from(tableMap.entries())
      .map(([tableNumber, entry]) => ({
        tableNumber,
        orderCount: entry.orderCount,
        revenue: Number(fromCents(entry.cents)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    byWeekday: Array.from(weekdayMap.entries())
      .map(([weekday, entry]) => ({
        weekday,
        orderCount: entry.orderCount,
        revenue: Number(fromCents(entry.cents)),
      }))
      .sort((a, b) => a.weekday - b.weekday),
    ticketDistribution: TICKET_BUCKETS.map((b) => ({
      bucket: b.label,
      orderCount: bucketCounts.get(b.label) ?? 0,
    })),
  };
}
