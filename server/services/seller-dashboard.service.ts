import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemSettings } from "../../shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInCalendarDays,
  subDays,
} from "date-fns";

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
  sellerName: string;
}

export interface SellerWinePriceTierRow {
  sellerId: string;
  sellerName: string;
  economico: { totalValue: number; percentage: number; quantity: number };
  intermediario: { totalValue: number; percentage: number; quantity: number };
  premium: { totalValue: number; percentage: number; quantity: number };
}

export interface WinePriceTierThresholds {
  lowThreshold: number;
  midThreshold: number;
}

export interface AggregateDashboardResult {
  monthlySummary: MonthlySummary;
  prevMonthSummary: MonthlySummary;
  salesEvolution: SalesEvolutionPoint[];
  topProducts: TopProductRow[];
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
  sellerRanking: SellerRankingRow[];
  sellerPortfolioStats: SellerPortfolioStats[];
  sellerWinePriceTiers: SellerWinePriceTierRow[];
  winePriceTierThresholds: WinePriceTierThresholds;
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
  winePriceTier: SellerWinePriceTierRow | null;
  winePriceTierThresholds: WinePriceTierThresholds;
}

export interface TopClientsResult {
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
}

export interface PortfolioStatsResult {
  sellerPortfolioStats: SellerPortfolioStats[];
  newClientsThisMonth: NewClientRow[];
}

export interface InactiveClientsResult {
  inactiveClients: InactiveClientRow[];
}

async function getPurchaseStatusDays(): Promise<number> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "purchase_status_days"));
  const days = parseInt(row?.value ?? "60", 10);
  return isNaN(days) || days <= 0 ? 60 : days;
}

async function getWinePriceTiers(): Promise<WinePriceTierThresholds> {
  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(
      inArray(systemSettings.key, [
        "wine_price_tier_low",
        "wine_price_tier_mid",
      ]),
    );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const low = parseFloat(map["wine_price_tier_low"] ?? "50");
  const mid = parseFloat(map["wine_price_tier_mid"] ?? "150");
  return {
    lowThreshold: isNaN(low) || low <= 0 ? 50 : low,
    midThreshold: isNaN(mid) || mid <= 0 ? 150 : mid,
  };
}

const EMPTY_SUMMARY: MonthlySummary = {
  totalValue: 0,
  totalOrders: 0,
  avgTicket: 0,
  uniqueClients: 0,
};

export async function getSellerDashboard(
  userId: string,
  blingVendedorId: string | null,
  startDate?: string,
  endDate?: string,
): Promise<SellerDashboardResult> {
  const [inactiveDays, winePriceTierThresholds] = await Promise.all([
    getPurchaseStatusDays(),
    getWinePriceTiers(),
  ]);

  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  const duration = differenceInCalendarDays(
    parseISO(currentEnd),
    parseISO(currentStart),
  );
  const prevEndDate = subDays(parseISO(currentStart), 1);
  const prevStartDate = subDays(prevEndDate, duration);
  const prevStart = format(prevStartDate, "yyyy-MM-dd");
  const prevEnd = format(prevEndDate, "yyyy-MM-dd");

  const EMPTY_PORTFOLIO: ClientPortfolioStats = {
    total: 0,
    active: 0,
    inactive: 0,
    positivacao: 0,
  };

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
    winePriceTier,
  ] = await Promise.all([
    fetchTopClientsByTotalForSeller(userId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByTotalForSeller:", e);
      return [] as TopClientRow[];
    }),
    fetchTopClientsByAvgTicketForSeller(userId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByAvgTicketForSeller:", e);
      return [] as TopClientRow[];
    }),
    fetchTopItemValueForSeller(userId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchTopItemValueForSeller:", e);
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
    fetchMonthlySummary(blingVendedorId, userId, currentStart, currentEnd).catch(
      (e) => {
        console.error("[seller-dashboard] fetchMonthlySummary:", e);
        return EMPTY_SUMMARY;
      },
    ),
    fetchMonthlySummary(blingVendedorId, userId, prevStart, prevEnd).catch((e) => {
      console.error("[seller-dashboard] fetchPrevMonthSummary:", e);
      return EMPTY_SUMMARY;
    }),
    fetchSalesEvolution(blingVendedorId, userId, currentStart, currentEnd).catch(
      (e) => {
        console.error("[seller-dashboard] fetchSalesEvolution:", e);
        return [] as SalesEvolutionPoint[];
      },
    ),
    fetchTopProducts(blingVendedorId, currentStart, currentEnd).catch((e) => {
      console.error("[seller-dashboard] fetchTopProducts:", e);
      return [] as TopProductRow[];
    }),
    fetchClientPortfolioStats(userId, inactiveDays).catch((e) => {
      console.error("[seller-dashboard] fetchClientPortfolioStats:", e);
      return EMPTY_PORTFOLIO;
    }),
    blingVendedorId
      ? fetchSingleSellerWinePriceTier(
          blingVendedorId,
          currentStart,
          currentEnd,
          winePriceTierThresholds.lowThreshold,
          winePriceTierThresholds.midThreshold,
        ).catch((e) => {
          console.error(
            "[seller-dashboard] fetchSingleSellerWinePriceTier:",
            e,
          );
          return null;
        })
      : Promise.resolve(null),
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
    winePriceTier,
    winePriceTierThresholds,
  };
}

// ─── Top Clientes por valor total (Bling only) ────────────────────────────────

async function fetchTopClientsByTotal(
  userId: string,
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(
    userId,
    blingVendedorId,
    "total_value",
    startDate,
    endDate,
  );
}

// ─── Top Clientes por ticket médio (Bling only) ───────────────────────────────

async function fetchTopClientsByAvgTicket(
  userId: string,
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(
    userId,
    blingVendedorId,
    "avg_ticket",
    startDate,
    endDate,
  );
}

// ─── Query base de agregação Bling only ──────────────────────────────────────

async function buildBlingAggQuery(
  _userId: string,
  blingVendedorId: string | null,
  sort: "total_value" | "avg_ticket",
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
  if (!blingVendedorId) return [];

  type Row = {
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  };

  const orderClause =
    sort === "total_value"
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
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
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

// ─── Top Clientes por carteira do vendedor (responsavel_id) ──────────────────
// Fallback quando blingVendedorId é nulo ou não há dados pelo seller_id

async function fetchTopClientsByTotalForSeller(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
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
    JOIN clients c ON c.id = bo.app_client_id
    WHERE c.responsavel_id = ${userId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
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

async function fetchTopClientsByAvgTicketForSeller(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
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
    JOIN clients c ON c.id = bo.app_client_id
    WHERE c.responsavel_id = ${userId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
    GROUP BY bo.app_client_id
    ORDER BY AVG(bo.total_value::numeric) DESC
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

async function fetchTopItemValueForSeller(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TopItemValueRow[]> {
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
    JOIN clients c ON c.id = bo.app_client_id
    WHERE c.responsavel_id = ${userId}
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

// ─── Clientes Inativos (Bling + Connect) ─────────────────────────────────────

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
      GREATEST(
        (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
        (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
      )::text AS last_purchase_date,
      (
        CURRENT_DATE - GREATEST(
          (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
          (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
        )
      ) AS days_since_purchase
    FROM clients c
    WHERE c.responsavel_id = ${userId}
      AND (
        EXISTS (SELECT 1 FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM connect_orders co WHERE co.app_client_id = c.id)
      )
      AND GREATEST(
        (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
        (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
      ) < CURRENT_DATE - (${daysStr} || ' days')::interval
    ORDER BY days_since_purchase DESC NULLS LAST
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    lastPurchaseDate: r.last_purchase_date,
    daysSincePurchase:
      r.days_since_purchase != null ? Number(r.days_since_purchase) : null,
  }));
}

// ─── Últimos 18 Clientes Cadastrados ─────────────────────────────────────────

async function fetchNewClientsThisMonth(
  userId: string,
): Promise<NewClientRow[]> {
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
  userId: string,
  startDate: string,
  endDate: string,
): Promise<MonthlySummary> {
  const [blingResult, connectResult] = await Promise.all([
    blingVendedorId
      ? db.execute<{
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
        `)
      : Promise.resolve({ rows: [] as any[] }),
    db.execute<{
      total_orders: unknown;
      total_value: string | null;
      avg_ticket: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                                AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)::text AS total_value,
        COALESCE(AVG(total_value::numeric), 0)::text AS avg_ticket
      FROM connect_orders
      WHERE seller_id = ${userId}
        AND sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
    `),
  ]);

  const blingRow = blingResult.rows[0];
  const connectRow = connectResult.rows[0];

  const blingTotal = parseFloat((blingRow as any)?.total_value ?? "0");
  const blingOrders = Number((blingRow as any)?.total_orders ?? 0);
  const blingClients = Number((blingRow as any)?.unique_clients ?? 0);

  const connectTotal = parseFloat((connectRow as any)?.total_value ?? "0");
  const connectOrders = Number((connectRow as any)?.total_orders ?? 0);

  const totalValue = blingTotal + connectTotal;
  const totalOrders = blingOrders + connectOrders;
  const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;
  const uniqueClients = blingClients;

  if (totalOrders === 0 && blingClients === 0) return EMPTY_SUMMARY;

  return {
    totalValue,
    totalOrders,
    avgTicket,
    uniqueClients,
  };
}

// ─── Evolução de vendas diária (Bling only) ───────────────────────────────────

async function fetchSalesEvolution(
  blingVendedorId: string | null,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SalesEvolutionPoint[]> {
  const result = await db.execute<{
    date: string;
    total_orders: unknown;
    total_value: string | null;
  }>(sql`
    SELECT
      date,
      SUM(total_orders)::int                         AS total_orders,
      COALESCE(SUM(total_value), 0)::text            AS total_value
    FROM (
      ${blingVendedorId
        ? sql`
          SELECT
            sale_date::text                              AS date,
            COUNT(*)                                     AS total_orders,
            COALESCE(SUM(total_value::numeric), 0)       AS total_value
          FROM bling_orders
          WHERE seller_id = ${blingVendedorId}
            AND deleted_at IS NULL
            AND sale_date >= ${startDate}
            AND sale_date <= ${endDate}
          GROUP BY sale_date
          UNION ALL
        `
        : sql``}
      SELECT
        sale_date::date::text                          AS date,
        COUNT(*)                                       AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)         AS total_value
      FROM connect_orders
      WHERE seller_id = ${userId}
        AND sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
      GROUP BY sale_date::date
    ) combined
    GROUP BY date
    ORDER BY date
  `);

  return result.rows.map((r) => ({
    date: r.date,
    totalOrders: Number(r.total_orders ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
  }));
}

// ─── Dashboard agregado (todos os vendedores) ────────────────────────────────

export async function getAggregateDashboard(
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<AggregateDashboardResult> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  const duration = differenceInCalendarDays(
    parseISO(currentEnd),
    parseISO(currentStart),
  );
  const prevEndDate = subDays(parseISO(currentStart), 1);
  const prevStartDate = subDays(prevEndDate, duration);
  const prevStart = format(prevStartDate, "yyyy-MM-dd");
  const prevEnd = format(prevEndDate, "yyyy-MM-dd");

  const [inactiveDays, winePriceTierThresholds] = await Promise.all([
    getPurchaseStatusDays(),
    getWinePriceTiers(),
  ]);

  const [
    monthlySummary,
    prevMonthSummary,
    salesEvolution,
    topProducts,
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
    sellerRanking,
    sellerPortfolioStats,
    sellerWinePriceTiers,
  ] = await Promise.all([
    fetchAggregateSummary(currentStart, currentEnd).catch(() => EMPTY_SUMMARY),
    fetchAggregateSummary(prevStart, prevEnd).catch(() => EMPTY_SUMMARY),
    fetchAggregateSalesEvolution(currentStart, currentEnd).catch(
      () => [] as SalesEvolutionPoint[],
    ),
    fetchAggregateTopProducts(currentStart, currentEnd).catch(
      () => [] as TopProductRow[],
    ),
    (userId
      ? fetchTopClientsByTotalForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopClients(currentStart, currentEnd)
    ).catch(() => [] as TopClientRow[]),
    (userId
      ? fetchTopClientsByAvgTicketForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopClientsByAvgTicket(currentStart, currentEnd)
    ).catch(() => [] as TopClientRow[]),
    (userId
      ? fetchTopItemValueForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopItemValue(currentStart, currentEnd)
    ).catch(() => [] as TopItemValueRow[]),
    (userId
      ? fetchInactiveClients(userId, inactiveDays)
      : fetchAggregateInactiveClients(inactiveDays)
    ).catch((e) => {
      console.error("[aggregate] inactiveClients:", e);
      return [] as InactiveClientRow[];
    }),
    (userId
      ? fetchNewClientsThisMonth(userId)
      : fetchAggregateNewClients()
    ).catch((e) => {
      console.error("[aggregate] newClientsThisMonth:", e);
      return [] as NewClientRow[];
    }),
    fetchSellerRanking(currentStart, currentEnd).catch(
      () => [] as SellerRankingRow[],
    ),
    (userId
      ? fetchClientPortfolioStats(userId, inactiveDays).then((s) => [
          { userId, sellerName: "", ...s },
        ])
      : fetchAllSellersPortfolioStats(inactiveDays)
    ).catch(() => [] as SellerPortfolioStats[]),
    fetchSellerWinePriceTierStats(
      currentStart,
      currentEnd,
      winePriceTierThresholds.lowThreshold,
      winePriceTierThresholds.midThreshold,
    ).catch(() => [] as SellerWinePriceTierRow[]),
  ]);

  return {
    monthlySummary,
    prevMonthSummary,
    salesEvolution,
    topProducts,
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
    sellerRanking,
    sellerPortfolioStats,
    sellerWinePriceTiers,
    winePriceTierThresholds,
  };
}

async function fetchAggregateSummary(
  startDate: string,
  endDate: string,
): Promise<MonthlySummary> {
  const [blingResult, connectResult] = await Promise.all([
    db.execute<{
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
    `),
    db.execute<{
      total_orders: unknown;
      total_value: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                                AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)::text AS total_value
      FROM connect_orders
      WHERE sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
    `),
  ]);

  const blingRow = blingResult.rows[0];
  const connectRow = connectResult.rows[0];

  const blingTotal = parseFloat((blingRow as any)?.total_value ?? "0");
  const blingOrders = Number((blingRow as any)?.total_orders ?? 0);
  const blingClients = Number((blingRow as any)?.unique_clients ?? 0);
  const connectTotal = parseFloat((connectRow as any)?.total_value ?? "0");
  const connectOrders = Number((connectRow as any)?.total_orders ?? 0);

  const totalValue = blingTotal + connectTotal;
  const totalOrders = blingOrders + connectOrders;
  const avgTicket = totalOrders > 0 ? totalValue / totalOrders : 0;

  return {
    totalValue,
    totalOrders,
    avgTicket,
    uniqueClients: blingClients,
  };
}

async function fetchAggregateSalesEvolution(
  startDate: string,
  endDate: string,
): Promise<SalesEvolutionPoint[]> {
  const result = await db.execute<{
    date: string;
    total_orders: unknown;
    total_value: string | null;
  }>(sql`
    SELECT
      date,
      SUM(total_orders)::int                          AS total_orders,
      COALESCE(SUM(total_value), 0)::text             AS total_value
    FROM (
      SELECT
        sale_date                                     AS date,
        COUNT(*)                                      AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)        AS total_value
      FROM bling_orders
      WHERE deleted_at IS NULL
        AND sale_date >= ${startDate}
        AND sale_date <= ${endDate}
      GROUP BY sale_date
      UNION ALL
      SELECT
        sale_date::date::text                         AS date,
        COUNT(*)                                      AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)        AS total_value
      FROM connect_orders
      WHERE sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
      GROUP BY sale_date::date
    ) combined
    GROUP BY date
    ORDER BY date
  `);
  return result.rows.map((r) => ({
    date: r.date,
    totalOrders: Number(r.total_orders ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
  }));
}

async function fetchAggregateTopProducts(
  startDate: string,
  endDate: string,
): Promise<TopProductRow[]> {
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

async function fetchAggregateTopClients(
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
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

async function fetchAggregateTopClientsByAvgTicket(
  startDate: string,
  endDate: string,
): Promise<TopClientRow[]> {
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
    ORDER BY AVG(bo.total_value::numeric) DESC
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

async function fetchAggregateTopItemValue(
  startDate: string,
  endDate: string,
): Promise<TopItemValueRow[]> {
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
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
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

async function fetchAggregateInactiveClients(
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
      GREATEST(
        (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
        (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
      )::text AS last_purchase_date,
      (
        CURRENT_DATE - GREATEST(
          (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
          (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
        )
      ) AS days_since_purchase
    FROM clients c
    WHERE (
        EXISTS (SELECT 1 FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM connect_orders co WHERE co.app_client_id = c.id)
      )
      AND GREATEST(
        (SELECT MAX(TO_DATE(bo.sale_date, 'YYYY-MM-DD')) FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL),
        (SELECT MAX(co.sale_date::date) FROM connect_orders co WHERE co.app_client_id = c.id)
      ) < CURRENT_DATE - (${daysStr} || ' days')::interval
    ORDER BY days_since_purchase DESC NULLS LAST
  `);
  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    lastPurchaseDate: r.last_purchase_date,
    daysSincePurchase: r.days_since_purchase != null ? Number(r.days_since_purchase) : null,
  }));
}

async function fetchAggregateNewClients(): Promise<NewClientRow[]> {
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

async function fetchSellerRanking(
  startDate: string,
  endDate: string,
): Promise<SellerRankingRow[]> {
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

async function fetchSingleSellerWinePriceTier(
  blingVendedorId: string,
  startDate: string,
  endDate: string,
  lowThreshold: number,
  midThreshold: number,
): Promise<SellerWinePriceTierRow | null> {
  const result = await db.execute<{
    seller_id: string | null;
    seller_name: string | null;
    economico_value: string | null;
    economico_qty: string | null;
    intermediario_value: string | null;
    intermediario_qty: string | null;
    premium_value: string | null;
    premium_qty: string | null;
    total_value: string | null;
  }>(sql`
    SELECT
      bo.seller_id                                                                                                                                                       AS seller_id,
      MAX(COALESCE(u.name, bo.seller_name))                                                                                                                             AS seller_name,
      COALESCE(SUM(CASE WHEN boi.value::numeric <= ${lowThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text                                AS economico_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric <= ${lowThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text                                                     AS economico_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text AS intermediario_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text            AS intermediario_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${midThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text                                AS premium_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text                                                     AS premium_qty,
      COALESCE(SUM(boi.value::numeric * boi.quantity::numeric), 0)::text                                                                                               AS total_value
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN LATERAL (
      SELECT id, name FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
    ) u ON true
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND bo.seller_id = ${blingVendedorId}
    GROUP BY bo.seller_id
  `);

  const r = result.rows[0];
  if (!r) return null;

  const economicoValue = parseFloat(r.economico_value ?? "0");
  const intermediarioValue = parseFloat(r.intermediario_value ?? "0");
  const premiumValue = parseFloat(r.premium_value ?? "0");
  const totalValue = parseFloat(r.total_value ?? "0");
  const safeTotal = totalValue > 0 ? totalValue : 1;

  return {
    sellerId: r.seller_id ?? "",
    sellerName: r.seller_name ?? "Desconhecido",
    economico: {
      totalValue: economicoValue,
      percentage: Math.round((economicoValue / safeTotal) * 100),
      quantity: parseFloat(r.economico_qty ?? "0"),
    },
    intermediario: {
      totalValue: intermediarioValue,
      percentage: Math.round((intermediarioValue / safeTotal) * 100),
      quantity: parseFloat(r.intermediario_qty ?? "0"),
    },
    premium: {
      totalValue: premiumValue,
      percentage: Math.round((premiumValue / safeTotal) * 100),
      quantity: parseFloat(r.premium_qty ?? "0"),
    },
  };
}

async function fetchSellerWinePriceTierStats(
  startDate: string,
  endDate: string,
  lowThreshold: number,
  midThreshold: number,
): Promise<SellerWinePriceTierRow[]> {
  const result = await db.execute<{
    seller_id: string | null;
    seller_name: string | null;
    economico_value: string | null;
    economico_qty: string | null;
    intermediario_value: string | null;
    intermediario_qty: string | null;
    premium_value: string | null;
    premium_qty: string | null;
    total_value: string | null;
  }>(sql`
    SELECT
      COALESCE(u.id, bo.seller_id)                                                                                AS seller_id,
      MAX(COALESCE(u.name, bo.seller_name))                                                                       AS seller_name,
      COALESCE(SUM(CASE WHEN boi.value::numeric <= ${lowThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text  AS economico_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric <= ${lowThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text                       AS economico_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text  AS intermediario_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text                       AS intermediario_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${midThreshold} THEN boi.value::numeric * boi.quantity::numeric ELSE 0 END), 0)::text  AS premium_value,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text                       AS premium_qty,
      COALESCE(SUM(boi.value::numeric * boi.quantity::numeric), 0)::text                                          AS total_value
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN LATERAL (
      SELECT id, name FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
    ) u ON true
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND bo.seller_id IS NOT NULL
    GROUP BY COALESCE(u.id, bo.seller_id)
    ORDER BY SUM(boi.value::numeric * boi.quantity::numeric) DESC
  `);

  return result.rows.map((r) => {
    const economicoValue = parseFloat(r.economico_value ?? "0");
    const intermediarioValue = parseFloat(r.intermediario_value ?? "0");
    const premiumValue = parseFloat(r.premium_value ?? "0");
    const totalValue = parseFloat(r.total_value ?? "0");
    const safeTotal = totalValue > 0 ? totalValue : 1;
    return {
      sellerId: r.seller_id ?? "",
      sellerName: r.seller_name ?? "Desconhecido",
      economico: {
        totalValue: economicoValue,
        percentage: Math.round((economicoValue / safeTotal) * 100),
        quantity: parseFloat(r.economico_qty ?? "0"),
      },
      intermediario: {
        totalValue: intermediarioValue,
        percentage: Math.round((intermediarioValue / safeTotal) * 100),
        quantity: parseFloat(r.intermediario_qty ?? "0"),
      },
      premium: {
        totalValue: premiumValue,
        percentage: Math.round((premiumValue / safeTotal) * 100),
        quantity: parseFloat(r.premium_qty ?? "0"),
      },
    };
  });
}

export interface WinePriceTierItemRow {
  orderDate: string;
  clientName: string | null;
  description: string;
  unitPrice: number;
  quantity: number;
  totalValue: number;
}

export interface SellerTierCounts {
  economico: number;
  intermediario: number;
  premium: number;
}

export async function getSellerTierCounts(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<SellerTierCounts> {
  const { lowThreshold, midThreshold } = await getWinePriceTiers();

  const result = await db.execute<{
    economico_qty: string | null;
    intermediario_qty: string | null;
    premium_qty: string | null;
  }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN boi.value::numeric <= ${lowThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text AS economico_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text AS intermediario_qty,
      COALESCE(SUM(CASE WHEN boi.value::numeric > ${midThreshold} THEN boi.quantity::numeric ELSE 0 END), 0)::text AS premium_qty
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN LATERAL (
      SELECT id FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
    ) u ON true
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND COALESCE(u.id, bo.seller_id) = ${userId}
  `);

  const row = result.rows[0];
  return {
    economico: parseFloat(row?.economico_qty ?? "0"),
    intermediario: parseFloat(row?.intermediario_qty ?? "0"),
    premium: parseFloat(row?.premium_qty ?? "0"),
  };
}

export async function getWinePriceTierItems(
  sellerId: string,
  startDate: string,
  endDate: string,
  tier: "economico" | "intermediario" | "premium",
): Promise<WinePriceTierItemRow[]> {
  const { lowThreshold, midThreshold } = await getWinePriceTiers();

  const tierCondition =
    tier === "economico"
      ? sql`boi.value::numeric <= ${lowThreshold}`
      : tier === "intermediario"
        ? sql`boi.value::numeric > ${lowThreshold} AND boi.value::numeric <= ${midThreshold}`
        : sql`boi.value::numeric > ${midThreshold}`;

  const result = await db.execute<{
    order_date: string;
    client_name: string | null;
    description: string | null;
    unit_price: string | null;
    quantity: string | null;
    total_value: string | null;
  }>(sql`
    SELECT
      bo.sale_date                                            AS order_date,
      COALESCE(c.name, bo.contact_name)                      AS client_name,
      boi.description,
      boi.value::text                                        AS unit_price,
      boi.quantity::text                                     AS quantity,
      (boi.value::numeric * boi.quantity::numeric)::text     AS total_value
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN LATERAL (
      SELECT id, name FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
    ) u ON true
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.deleted_at IS NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      AND COALESCE(u.id, bo.seller_id) = ${sellerId}
      AND ${tierCondition}
    ORDER BY bo.sale_date DESC, total_value DESC
  `);

  return result.rows.map((r) => ({
    orderDate: r.order_date,
    clientName: r.client_name,
    description: r.description ?? "Produto desconhecido",
    unitPrice: parseFloat(r.unit_price ?? "0"),
    quantity: parseFloat(r.quantity ?? "0"),
    totalValue: parseFloat(r.total_value ?? "0"),
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
    seller_name: string | null;
    total: unknown;
    active_count: unknown;
  }>(sql`
    SELECT
      c.responsavel_id                                                   AS user_id,
      u.name                                                             AS seller_name,
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
    JOIN users u ON u.id = c.responsavel_id
    WHERE c.responsavel_id IS NOT NULL
    GROUP BY c.responsavel_id, u.name
  `);

  return result.rows.map((r) => {
    const total = Number(r.total ?? 0);
    const active = Number(r.active_count ?? 0);
    const inactive = total - active;
    const positivacao = total > 0 ? (active / total) * 100 : 0;
    return {
      userId: r.user_id,
      sellerName: r.seller_name ?? "Desconhecido",
      total,
      active,
      inactive,
      positivacao,
    };
  });
}

// ─── Funções exportadas para rotas focadas ────────────────────────────────────

export async function getTopClientsData(
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<TopClientsResult> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd   = endDate   ?? format(endOfMonth(now),   "yyyy-MM-dd");

  const [topClients, highestAvgTicket, highestAvgItemValue] = await Promise.all([
    (userId
      ? fetchTopClientsByTotalForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopClients(currentStart, currentEnd)
    ).catch(() => [] as TopClientRow[]),
    (userId
      ? fetchTopClientsByAvgTicketForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopClientsByAvgTicket(currentStart, currentEnd)
    ).catch(() => [] as TopClientRow[]),
    (userId
      ? fetchTopItemValueForSeller(userId, currentStart, currentEnd)
      : fetchAggregateTopItemValue(currentStart, currentEnd)
    ).catch(() => [] as TopItemValueRow[]),
  ]);

  return { topClients, highestAvgTicket, highestAvgItemValue };
}

export async function getPortfolioStatsData(
  _startDate?: string,
  _endDate?: string,
  userId?: string,
): Promise<PortfolioStatsResult> {
  const inactiveDays = await getPurchaseStatusDays();

  const [sellerPortfolioStats, newClientsThisMonth] = await Promise.all([
    (userId
      ? fetchClientPortfolioStats(userId, inactiveDays).then((s) => [
          { userId, sellerName: "", ...s } as SellerPortfolioStats,
        ])
      : fetchAllSellersPortfolioStats(inactiveDays)
    ).catch(() => [] as SellerPortfolioStats[]),
    (userId
      ? fetchNewClientsThisMonth(userId)
      : fetchAggregateNewClients()
    ).catch(() => [] as NewClientRow[]),
  ]);

  return { sellerPortfolioStats, newClientsThisMonth };
}

export async function getInactiveClientsData(
  userId?: string,
): Promise<InactiveClientsResult> {
  const inactiveDays = await getPurchaseStatusDays();

  const inactiveClients = await (userId
    ? fetchInactiveClients(userId, inactiveDays)
    : fetchAggregateInactiveClients(inactiveDays)
  ).catch((e) => {
    console.error("[getInactiveClientsData]", e);
    return [] as InactiveClientRow[];
  });

  return { inactiveClients };
}
