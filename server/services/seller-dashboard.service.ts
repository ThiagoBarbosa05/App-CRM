import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

// ─── Tipos de agregação (todos os vendedores) ─────────────────────────────────

export interface SellerRankingRow {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
  avgTicket: number;
}

export interface ClientPortfolioStats {
  total: number;
  active: number;
  inactive: number;
  positivacao: number;
}

export interface SellerPortfolioStats extends ClientPortfolioStats {
  userId: string;
}

export interface AggregateDashboardResult {
  monthlySummary: MonthlySummary;
  prevMonthSummary: MonthlySummary;
  salesEvolution: SalesEvolutionPoint[];
  topProducts: TopProductRow[];
  topClients: TopClientRow[];
  sellerRanking: SellerRankingRow[];
  sellerPortfolioStats: SellerPortfolioStats[];
}

export interface TopClientRow {
  clientId: string | null;
  clientName: string | null;
  orderCount: number;
  totalValue: number;
  avgTicket: number;
}

export interface TopItemValueRow {
  clientId: string | null;
  clientName: string | null;
  avgItemValue: number;
  itemCount: number;
}

export interface InactiveClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  lastPurchaseDate: string | null;
  daysSincePurchase: number | null;
}

export interface NewClientRow {
  clientId: string;
  clientName: string;
  phone: string | null;
  createdAt: string;
}

export interface MonthlySummary {
  totalValue: number;
  totalOrders: number;
  avgTicket: number;
  uniqueClients: number;
}

export interface SalesEvolutionPoint {
  date: string;
  totalOrders: number;
  totalValue: number;
}

export interface TopProductRow {
  productCode: string;
  description: string;
  totalQuantity: number;
  totalValue: number;
  orderCount: number;
}

export interface SellerDashboardResult {
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
  monthlySummary: MonthlySummary;
  prevMonthSummary: MonthlySummary;
  salesEvolution: SalesEvolutionPoint[];
  topProducts: TopProductRow[];
  portfolioStats: ClientPortfolioStats;
}

async function getPurchaseStatusDays(): Promise<number> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "purchase_status_days"));
  const days = parseInt(row?.value ?? "60", 10);
  return isNaN(days) || days <= 0 ? 60 : days;
}

const EMPTY_SUMMARY: MonthlySummary = { totalValue: 0, totalOrders: 0, avgTicket: 0, uniqueClients: 0 };

export async function getSellerDashboard(
  userId: string,
  blingVendedorId: string | null,
): Promise<SellerDashboardResult> {
  const inactiveDays = await getPurchaseStatusDays();

  const now = new Date();
  const currentStart = format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const prevMonth = subMonths(now, 1);
  const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const EMPTY_PORTFOLIO: ClientPortfolioStats = { total: 0, active: 0, inactive: 0, positivacao: 0 };

  const [
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
    monthlySummary,
    prevMonthSummary,
    salesEvolution,
    topProducts,
    portfolioStats,
  ] = await Promise.all([
    fetchTopClientsByTotal(userId, blingVendedorId).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByTotal:", e);
      return [] as TopClientRow[];
    }),
    fetchTopClientsByAvgTicket(userId, blingVendedorId).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByAvgTicket:", e);
      return [] as TopClientRow[];
    }),
    fetchTopItemValue(blingVendedorId).catch((e) => {
      console.error("[seller-dashboard] fetchTopItemValue:", e);
      return [] as TopItemValueRow[];
    }),
    fetchInactiveClients(userId, inactiveDays).catch((e) => {
      console.error("[seller-dashboard] fetchInactiveClients:", e);
      return [] as InactiveClientRow[];
    }),
    fetchNewClientsThisMonth(userId).catch((e) => {
      console.error("[seller-dashboard] fetchNewClientsThisMonth:", e);
      return [] as NewClientRow[];
    }),
    fetchMonthlySummary(blingVendedorId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchMonthlySummary:", e);
      return EMPTY_SUMMARY;
    }),
    fetchMonthlySummary(blingVendedorId, prevStart, prevEnd).catch((e) => {
      console.error("[seller-dashboard] fetchPrevMonthSummary:", e);
      return EMPTY_SUMMARY;
    }),
    fetchSalesEvolution(blingVendedorId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchSalesEvolution:", e);
      return [] as SalesEvolutionPoint[];
    }),
    fetchTopProducts(blingVendedorId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchTopProducts:", e);
      return [] as TopProductRow[];
    }),
    fetchClientPortfolioStats(userId, inactiveDays).catch((e) => {
      console.error("[seller-dashboard] fetchClientPortfolioStats:", e);
      return EMPTY_PORTFOLIO;
    }),
  ]);

  return {
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
    monthlySummary,
    prevMonthSummary,
    salesEvolution,
    topProducts,
    portfolioStats,
  };
}

// ─── Top Clientes por valor total (Bling only) ────────────────────────────────

async function fetchTopClientsByTotal(
  userId: string,
  blingVendedorId: string | null,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(userId, blingVendedorId, "total_value");
}

// ─── Top Clientes por ticket médio (Bling only) ───────────────────────────────

async function fetchTopClientsByAvgTicket(
  userId: string,
  blingVendedorId: string | null,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(userId, blingVendedorId, "avg_ticket");
}

// ─── Query base de agregação Bling only ──────────────────────────────────────

async function buildBlingAggQuery(
  _userId: string,
  blingVendedorId: string | null,
  sort: "total_value" | "avg_ticket",
): Promise<TopClientRow[]> {
  if (!blingVendedorId) return [];

  type Row = {
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  };

  const orderClause = sort === "total_value"
    ? sql`ORDER BY SUM(bo.total_value::numeric) DESC`
    : sql`ORDER BY AVG(bo.total_value::numeric) DESC`;

  const result = await db.execute<Row>(sql`
    SELECT
      bo.app_client_id                                  AS client_id,
      MAX(COALESCE(c.name, bo.contact_name))            AS client_name,
      COUNT(*)::int                                     AS order_count,
      SUM(bo.total_value::numeric)::text                AS total_value,
      AVG(bo.total_value::numeric)::text                AS avg_ticket
    FROM bling_orders bo
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.seller_id = ${blingVendedorId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
    GROUP BY bo.app_client_id
    ${orderClause}
    LIMIT 10
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    orderCount: Number(r.order_count ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
    avgTicket: parseFloat(r.avg_ticket ?? "0"),
  }));
}

// ─── Top Clientes por valor médio de item ────────────────────────────────────

async function fetchTopItemValue(
  blingVendedorId: string | null,
): Promise<TopItemValueRow[]> {
  if (!blingVendedorId) return [];

  const result = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    avg_item_value: string | null;
    item_count: unknown;
  }>(sql`
    SELECT
      bo.app_client_id                              AS client_id,
      MAX(COALESCE(c.name, bo.contact_name))        AS client_name,
      AVG(boi.value::numeric)::text                 AS avg_item_value,
      COUNT(boi.id)::int                            AS item_count
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.seller_id = ${blingVendedorId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
    GROUP BY bo.app_client_id
    ORDER BY AVG(boi.value::numeric) DESC
    LIMIT 10
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    avgItemValue: parseFloat(r.avg_item_value ?? "0"),
    itemCount: Number(r.item_count ?? 0),
  }));
}

// ─── Clientes Inativos (Bling only) ──────────────────────────────────────────

async function fetchInactiveClients(
  userId: string,
  inactiveDays: number,
): Promise<InactiveClientRow[]> {
  const daysStr = String(inactiveDays);

  const result = await db.execute<{
    client_id: string;
    client_name: string;
    phone: string | null;
    last_purchase_date: string | null;
    days_since_purchase: unknown;
  }>(sql`
    SELECT
      c.id   AS client_id,
      c.name AS client_name,
      c.phone,
      (
        SELECT MAX(TO_DATE(bo2.sale_date, 'YYYY-MM-DD'))::text
        FROM bling_orders bo2
        WHERE bo2.app_client_id = c.id AND bo2.deleted_at IS NULL
      ) AS last_purchase_date,
      (
        CURRENT_DATE - (
          SELECT MAX(TO_DATE(bo2.sale_date, 'YYYY-MM-DD'))
          FROM bling_orders bo2
          WHERE bo2.app_client_id = c.id AND bo2.deleted_at IS NULL
        )
      ) AS days_since_purchase
    FROM clients c
    WHERE c.responsavel_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM bling_orders bo3
        WHERE bo3.app_client_id = c.id
          AND bo3.deleted_at IS NULL
          AND TO_DATE(bo3.sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${daysStr} || ' days')::interval
      )
    ORDER BY days_since_purchase DESC NULLS LAST
    LIMIT 50
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    lastPurchaseDate: r.last_purchase_date,
    daysSincePurchase: r.days_since_purchase != null ? Number(r.days_since_purchase) : null,
  }));
}

// ─── Últimos 18 Clientes Cadastrados ─────────────────────────────────────────

async function fetchNewClientsThisMonth(userId: string): Promise<NewClientRow[]> {
  const result = await db.execute<{
    client_id: string;
    client_name: string;
    phone: string | null;
    created_at: string;
  }>(sql`
    SELECT
      id         AS client_id,
      name       AS client_name,
      phone,
      created_at::text
    FROM clients
    WHERE responsavel_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 18
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    createdAt: r.created_at,
  }));
}

// ─── Resumo mensal (Bling only) ───────────────────────────────────────────────

async function fetchMonthlySummary(
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
): Promise<MonthlySummary> {
  if (!blingVendedorId) return EMPTY_SUMMARY;

  const result = await db.execute<{
    total_orders: unknown;
    total_value: string | null;
    avg_ticket: string | null;
    unique_clients: unknown;
  }>(sql`
    SELECT
      COUNT(*)::int                                                    AS total_orders,
      COALESCE(SUM(total_value::numeric), 0)::text                    AS total_value,
      COALESCE(AVG(total_value::numeric), 0)::text                    AS avg_ticket,
      COUNT(DISTINCT COALESCE(app_client_id::text, contact_id))::int  AS unique_clients
    FROM bling_orders
    WHERE seller_id = ${blingVendedorId}
      AND deleted_at IS NULL
      AND sale_date >= ${startDate}
      AND sale_date <= ${endDate}
  `);

  const row = result.rows[0];
  if (!row) return EMPTY_SUMMARY;

  return {
    totalValue: parseFloat(row.total_value ?? "0"),
    totalOrders: Number(row.total_orders ?? 0),
    avgTicket: parseFloat(row.avg_ticket ?? "0"),
    uniqueClients: Number(row.unique_clients ?? 0),
  };
}

// ─── Evolução de vendas diária (Bling only) ───────────────────────────────────

async function fetchSalesEvolution(
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
): Promise<SalesEvolutionPoint[]> {
  if (!blingVendedorId) return [];

  const result = await db.execute<{
    date: string;
    total_orders: unknown;
    total_value: string | null;
  }>(sql`
    SELECT
      sale_date                                  AS date,
      COUNT(*)::int                              AS total_orders,
      COALESCE(SUM(total_value::numeric), 0)::text AS total_value
    FROM bling_orders
    WHERE seller_id = ${blingVendedorId}
      AND deleted_at IS NULL
      AND sale_date >= ${startDate}
      AND sale_date <= ${endDate}
    GROUP BY sale_date
    ORDER BY sale_date
  `);

  return result.rows.map((r) => ({
    date: r.date,
    totalOrders: Number(r.total_orders ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
  }));
}

// ─── Dashboard agregado (todos os vendedores) ────────────────────────────────

export async function getAggregateDashboard(): Promise<AggregateDashboardResult> {
  const now = new Date();
  const currentStart = format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const prevMonth = subMonths(now, 1);
  const prevStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const inactiveDays = await getPurchaseStatusDays();

  const [
    monthlySummary,
    prevMonthSummary,
    salesEvolution,
    topProducts,
    topClients,
    sellerRanking,
    sellerPortfolioStats,
  ] = await Promise.all([
    fetchAggregateSummary(currentStart, currentEnd).catch(() => EMPTY_SUMMARY),
    fetchAggregateSummary(prevStart, prevEnd).catch(() => EMPTY_SUMMARY),
    fetchAggregateSalesEvolution(currentStart, currentEnd).catch(() => [] as SalesEvolutionPoint[]),
    fetchAggregateTopProducts(currentStart, currentEnd).catch(() => [] as TopProductRow[]),
    fetchAggregateTopClients(currentStart, currentEnd).catch(() => [] as TopClientRow[]),
    fetchSellerRanking(currentStart, currentEnd).catch(() => [] as SellerRankingRow[]),
    fetchAllSellersPortfolioStats(inactiveDays).catch(() => [] as SellerPortfolioStats[]),
  ]);

  return { monthlySummary, prevMonthSummary, salesEvolution, topProducts, topClients, sellerRanking, sellerPortfolioStats };
}

async function fetchAggregateSummary(startDate: string, endDate: string): Promise<MonthlySummary> {
  const result = await db.execute<{
    total_orders: unknown;
    total_value: string | null;
    avg_ticket: string | null;
    unique_clients: unknown;
  }>(sql`
    SELECT
      COUNT(*)::int                                                    AS total_orders,
      COALESCE(SUM(total_value::numeric), 0)::text                    AS total_value,
      COALESCE(AVG(total_value::numeric), 0)::text                    AS avg_ticket,
      COUNT(DISTINCT COALESCE(app_client_id::text, contact_id))::int  AS unique_clients
    FROM bling_orders
    WHERE deleted_at IS NULL
      AND sale_date >= ${startDate}
      AND sale_date <= ${endDate}
  `);
  const row = result.rows[0];
  if (!row) return EMPTY_SUMMARY;
  return {
    totalValue: parseFloat(row.total_value ?? "0"),
    totalOrders: Number(row.total_orders ?? 0),
    avgTicket: parseFloat(row.avg_ticket ?? "0"),
    uniqueClients: Number(row.unique_clients ?? 0),
  };
}

async function fetchAggregateSalesEvolution(startDate: string, endDate: string): Promise<SalesEvolutionPoint[]> {
  const result = await db.execute<{
    date: string;
    total_orders: unknown;
    total_value: string | null;
  }>(sql`
    SELECT
      sale_date                                       AS date,
      COUNT(*)::int                                   AS total_orders,
      COALESCE(SUM(total_value::numeric), 0)::text   AS total_value
    FROM bling_orders
    WHERE deleted_at IS NULL
      AND sale_date >= ${startDate}
      AND sale_date <= ${endDate}
    GROUP BY sale_date
    ORDER BY sale_date
  `);
  return result.rows.map((r) => ({
    date: r.date,
    totalOrders: Number(r.total_orders ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
  }));
}

async function fetchAggregateTopProducts(startDate: string, endDate: string): Promise<TopProductRow[]> {
  const result = await db.execute<{
    product_code: string | null;
    description: string | null;
    total_quantity: string | null;
    total_value: string | null;
    order_count: unknown;
  }>(sql`
    SELECT
      boi.product_code,
      boi.description,
      SUM(boi.quantity::numeric)::text                        AS total_quantity,
      SUM(boi.quantity::numeric * boi.value::numeric)::text  AS total_value,
      COUNT(DISTINCT bo.id)::int                             AS order_count
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
    GROUP BY boi.product_code, boi.description
    ORDER BY SUM(boi.quantity::numeric * boi.value::numeric) DESC
    LIMIT 8
  `);
  return result.rows.map((r) => ({
    productCode: r.product_code ?? "",
    description: r.description ?? "Produto desconhecido",
    totalQuantity: parseFloat(r.total_quantity ?? "0"),
    totalValue: parseFloat(r.total_value ?? "0"),
    orderCount: Number(r.order_count ?? 0),
  }));
}

async function fetchAggregateTopClients(startDate: string, endDate: string): Promise<TopClientRow[]> {
  const result = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  }>(sql`
    SELECT
      bo.app_client_id                              AS client_id,
      MAX(COALESCE(c.name, bo.contact_name))        AS client_name,
      COUNT(*)::int                                 AS order_count,
      SUM(bo.total_value::numeric)::text            AS total_value,
      AVG(bo.total_value::numeric)::text            AS avg_ticket
    FROM bling_orders bo
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND bo.app_client_id IS NOT NULL
    GROUP BY bo.app_client_id
    ORDER BY SUM(bo.total_value::numeric) DESC
    LIMIT 10
  `);
  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    orderCount: Number(r.order_count ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
    avgTicket: parseFloat(r.avg_ticket ?? "0"),
  }));
}

async function fetchSellerRanking(startDate: string, endDate: string): Promise<SellerRankingRow[]> {
  const result = await db.execute<{
    seller_id: string | null;
    seller_name: string | null;
    total_orders: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  }>(sql`
    SELECT
      COALESCE(u.id, bo.seller_id)                  AS seller_id,
      MAX(COALESCE(u.name, bo.seller_name))          AS seller_name,
      COUNT(*)::int                                  AS total_orders,
      SUM(bo.total_value::numeric)::text             AS total_value,
      AVG(bo.total_value::numeric)::text             AS avg_ticket
    FROM bling_orders bo
    LEFT JOIN LATERAL (
      SELECT id, name FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
    ) u ON true
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND bo.seller_id IS NOT NULL
    GROUP BY COALESCE(u.id, bo.seller_id)
    ORDER BY SUM(bo.total_value::numeric) DESC
    LIMIT 20
  `);
  return result.rows.map((r) => ({
    sellerId: r.seller_id ?? "",
    sellerName: r.seller_name ?? "Desconhecido",
    totalOrders: Number(r.total_orders ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
    avgTicket: parseFloat(r.avg_ticket ?? "0"),
  }));
}

// ─── Top produtos do mês (Bling only) ────────────────────────────────────────

async function fetchTopProducts(
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
): Promise<TopProductRow[]> {
  if (!blingVendedorId) return [];

  const result = await db.execute<{
    product_code: string | null;
    description: string | null;
    total_quantity: string | null;
    total_value: string | null;
    order_count: unknown;
  }>(sql`
    SELECT
      boi.product_code,
      boi.description,
      SUM(boi.quantity::numeric)::text                        AS total_quantity,
      SUM(boi.quantity::numeric * boi.value::numeric)::text  AS total_value,
      COUNT(DISTINCT bo.id)::int                             AS order_count
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    WHERE bo.seller_id = ${blingVendedorId}
      AND bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
    GROUP BY boi.product_code, boi.description
    ORDER BY SUM(boi.quantity::numeric * boi.value::numeric) DESC
    LIMIT 5
  `);

  return result.rows.map((r) => ({
    productCode: r.product_code ?? "",
    description: r.description ?? "Produto desconhecido",
    totalQuantity: parseFloat(r.total_quantity ?? "0"),
    totalValue: parseFloat(r.total_value ?? "0"),
    orderCount: Number(r.order_count ?? 0),
  }));
}

// ─── Carteira do vendedor: total e positivação ────────────────────────────────

async function fetchClientPortfolioStats(
  userId: string,
  inactiveDays: number,
): Promise<ClientPortfolioStats> {
  const daysStr = String(inactiveDays);

  const result = await db.execute<{
    total: unknown;
    active_count: unknown;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM bling_orders bo
          WHERE bo.app_client_id = c.id
            AND bo.deleted_at IS NULL
            AND TO_DATE(bo.sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
      )::int AS active_count
    FROM clients c
    WHERE c.responsavel_id = ${userId}
  `);

  const row = result.rows[0];
  const total = Number(row?.total ?? 0);
  const active = Number(row?.active_count ?? 0);
  const inactive = total - active;
  const positivacao = total > 0 ? (active / total) * 100 : 0;

  return { total, active, inactive, positivacao };
}

// ─── Carteira de todos os vendedores (admin) ──────────────────────────────────

async function fetchAllSellersPortfolioStats(
  inactiveDays: number,
): Promise<SellerPortfolioStats[]> {
  const daysStr = String(inactiveDays);

  const result = await db.execute<{
    user_id: string;
    total: unknown;
    active_count: unknown;
  }>(sql`
    SELECT
      c.responsavel_id                                                   AS user_id,
      COUNT(*)::int                                                      AS total,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM bling_orders bo
          WHERE bo.app_client_id = c.id
            AND bo.deleted_at IS NULL
            AND TO_DATE(bo.sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
      )::int                                                             AS active_count
    FROM clients c
    WHERE c.responsavel_id IS NOT NULL
    GROUP BY c.responsavel_id
  `);

  return result.rows.map((r) => {
    const total = Number(r.total ?? 0);
    const active = Number(r.active_count ?? 0);
    const inactive = total - active;
    const positivacao = total > 0 ? (active / total) * 100 : 0;
    return { userId: r.user_id, total, active, inactive, positivacao };
  });
}
