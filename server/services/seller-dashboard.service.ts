import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemSettings, userGoals, weeklyResults } from "../../shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { ClientsRepository } from "../repositories/clients.repository";
import type { ClientFilters } from "../storage";
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
  avgItemValue: number;
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
  avgItemValue: 0,
};

interface ClientAnalyticsScope {
  requestUserId?: string;
  requestUserRole?: string;
  filterUserId?: string;
  filters?: ClientFilters;
}

const clientsRepository = new ClientsRepository();

function buildClientIdsCondition(
  columnExpression: string,
  clientIds?: string[] | null,
  prefix: "AND" | "WHERE" = "AND",
) {
  if (!clientIds || clientIds.length === 0) {
    return sql``;
  }

  const safeList = clientIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
  return sql.raw(` ${prefix} ${columnExpression} IN (${safeList})`);
}

function hasActiveClientFilters(filters: ClientFilters = {}): boolean {
  return Object.values(filters).some((value) => {
    if (typeof value === "number") {
      return true;
    }

    return Boolean(value && value !== "all");
  });
}

async function resolveScopedClientIds(
  scope?: ClientAnalyticsScope,
): Promise<string[] | null> {
  if (!scope) {
    return null;
  }

  const filters = scope.filters ?? {};
  const shouldScope = Boolean(scope.filterUserId) || hasActiveClientFilters(filters);

  if (!shouldScope) {
    return null;
  }

  return clientsRepository.getFilteredClientIds(
    scope.requestUserId,
    scope.requestUserRole,
    filters,
    scope.filterUserId,
  );
}

export async function getSellerDashboard(
  userId: string,
  blingVendedorId: string | null,
  startDate?: string,
  endDate?: string,
  scope?: ClientAnalyticsScope,
  prevStartDateOverride?: string,
  prevEndDateOverride?: string,
): Promise<SellerDashboardResult> {
  const [inactiveDays, winePriceTierThresholds] = await Promise.all([
    getPurchaseStatusDays(),
    getWinePriceTiers(),
  ]);

  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  let prevStart: string;
  let prevEnd: string;
  if (prevStartDateOverride && prevEndDateOverride) {
    prevStart = prevStartDateOverride;
    prevEnd = prevEndDateOverride;
  } else {
    const duration = differenceInCalendarDays(
      parseISO(currentEnd),
      parseISO(currentStart),
    );
    const prevEndDate = subDays(parseISO(currentStart), 1);
    const prevStartDate = subDays(prevEndDate, duration);
    prevStart = format(prevStartDate, "yyyy-MM-dd");
    prevEnd = format(prevEndDate, "yyyy-MM-dd");
  }
  const scopedClientIds = await resolveScopedClientIds(scope);

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
    (blingVendedorId
      ? fetchTopClientsByTotal(
          userId,
          blingVendedorId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )
      : fetchTopClientsByTotalForSeller(
          userId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByTotal:", e);
      return [] as TopClientRow[];
    }),
    (blingVendedorId
      ? fetchTopClientsByAvgTicket(
          userId,
          blingVendedorId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )
      : fetchTopClientsByAvgTicketForSeller(
          userId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )).catch((e) => {
      console.error("[seller-dashboard] fetchTopClientsByAvgTicket:", e);
      return [] as TopClientRow[];
    }),
    (blingVendedorId
      ? fetchTopItemValue(
          blingVendedorId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )
      : fetchTopItemValueForSeller(
          userId,
          currentStart,
          currentEnd,
          scopedClientIds,
        )).catch((e) => {
      console.error("[seller-dashboard] fetchTopItemValue:", e);
      return [] as TopItemValueRow[];
    }),
    fetchInactiveClients(userId, inactiveDays, scopedClientIds).catch((e) => {
      console.error("[seller-dashboard] fetchInactiveClients:", e);
      return [] as InactiveClientRow[];
    }),
    fetchNewClientsThisMonth(userId, currentStart, currentEnd, scopedClientIds).catch((e) => {
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
    fetchClientPortfolioStats(userId, inactiveDays, scopedClientIds).catch((e) => {
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
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(
    userId,
    blingVendedorId,
    "total_value",
    startDate,
    endDate,
    clientIds,
  );
}

// ─── Top Clientes por ticket médio (Bling only) ───────────────────────────────

async function fetchTopClientsByAvgTicket(
  userId: string,
  blingVendedorId: string | null,
  startDate: string,
  endDate: string,
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  return buildBlingAggQuery(
    userId,
    blingVendedorId,
    "avg_ticket",
    startDate,
    endDate,
    clientIds,
  );
}

// ─── Query base de agregação Bling only ──────────────────────────────────────

async function buildBlingAggQuery(
  _userId: string,
  blingVendedorId: string | null,
  sort: "total_value" | "avg_ticket",
  startDate: string,
  endDate: string,
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  if (!blingVendedorId) return [];
  if (clientIds && clientIds.length === 0) return [];

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
      AND bo.situation_id = '9'
      AND bo.app_client_id IS NOT NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      ${buildClientIdsCondition("bo.app_client_id", clientIds)}
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
  startDate: string,
  endDate: string,
  clientIds?: string[] | null,
): Promise<TopItemValueRow[]> {
  if (!blingVendedorId) return [];
  if (clientIds && clientIds.length === 0) return [];

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
      AND bo.situation_id = '9'
      AND bo.app_client_id IS NOT NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
      ${buildClientIdsCondition("bo.app_client_id", clientIds)}
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
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
      ${buildClientIdsCondition("c.id", clientIds)}
      AND bo.deleted_at IS NULL
      AND bo.situation_id = '9'
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
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
      ${buildClientIdsCondition("c.id", clientIds)}
      AND bo.deleted_at IS NULL
      AND bo.situation_id = '9'
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
  clientIds?: string[] | null,
): Promise<TopItemValueRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
      ${buildClientIdsCondition("c.id", clientIds)}
      AND bo.deleted_at IS NULL
      AND bo.situation_id = '9'
      AND bo.app_client_id IS NOT NULL
      AND bo.sale_date >= ${startDate}
      AND bo.sale_date <= ${endDate}
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
  clientIds?: string[] | null,
): Promise<InactiveClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
      ${buildClientIdsCondition("c.id", clientIds)}
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
  startDate: string,
  endDate: string,
  clientIds?: string[] | null,
): Promise<NewClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
      AND created_at::date >= ${startDate}::date
      AND created_at::date <= ${endDate}::date
      ${buildClientIdsCondition("id", clientIds)}
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
  const refDate = new Date(startDate + "T12:00:00");
  const month = refDate.getMonth() + 1;
  const year = refDate.getFullYear();

  const [blingResult, connectResult, manualResult] = await Promise.all([
    blingVendedorId
      ? db.execute<{
          total_orders: unknown;
          total_value: string | null;
          unique_clients: unknown;
          avg_item_value: string | null;
        }>(sql`
          SELECT
            COUNT(DISTINCT bo.id)::int                                              AS total_orders,
            COALESCE(SUM(DISTINCT bo.total_value::numeric), 0)::text               AS total_value,
            COUNT(DISTINCT COALESCE(bo.app_client_id::text, bo.contact_id))::int   AS unique_clients,
            COALESCE(
              SUM(boi.value::numeric * boi.quantity::numeric)
              / NULLIF(SUM(boi.quantity::numeric), 0),
              0
            )::text                                                                 AS avg_item_value
          FROM bling_orders bo
          LEFT JOIN bling_order_items boi ON boi.order_id = bo.id
          WHERE bo.seller_id = ${blingVendedorId}
            AND bo.deleted_at IS NULL
            AND bo.situation_id = '9'
            AND bo.sale_date >= ${startDate}
            AND bo.sale_date <= ${endDate}
        `)
      : Promise.resolve({ rows: [] as any[] }),
    db.execute<{
      total_orders: unknown;
      total_value: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                                AS total_orders,
        COALESCE(SUM(total_value::numeric), 0)::text AS total_value
      FROM connect_orders
      WHERE seller_id = ${userId}
        AND sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
    `),
    // Vendas lançadas manualmente via sistema de metas
    db
      .select({
        salesAchieved: weeklyResults.salesAchieved,
        avgGrfValue: weeklyResults.avgGrfValue,
      })
      .from(weeklyResults)
      .innerJoin(userGoals, eq(weeklyResults.goalId, userGoals.id))
      .where(
        and(
          eq(userGoals.userId, userId),
          eq(userGoals.month, month),
          eq(userGoals.year, year),
        ),
      ),
  ]);

  const blingRow = blingResult.rows[0] as any;
  const connectRow = connectResult.rows[0] as any;

  const blingTotal = parseFloat(blingRow?.total_value ?? "0");
  const blingOrders = Number(blingRow?.total_orders ?? 0);
  const blingClients = Number(blingRow?.unique_clients ?? 0);
  const blingAvgItem = parseFloat(blingRow?.avg_item_value ?? "0");

  const connectTotal = parseFloat(connectRow?.total_value ?? "0");
  const connectOrders = Number(connectRow?.total_orders ?? 0);

  const manualSales = manualResult.reduce(
    (sum, r) => sum + parseFloat(r.salesAchieved ?? "0"),
    0,
  );
  const manualAvgGrf =
    manualResult.length > 0
      ? parseFloat(manualResult[0].avgGrfValue ?? "0")
      : 0;

  const totalValue = blingTotal + connectTotal + manualSales;
  const totalOrders = blingOrders + connectOrders;
  const avgTicket =
    totalOrders > 0 ? (blingTotal + connectTotal) / totalOrders : 0;
  const uniqueClients = blingClients;
  const avgItemValue = blingAvgItem > 0 ? blingAvgItem : manualAvgGrf;

  if (totalValue === 0 && totalOrders === 0 && blingClients === 0) return EMPTY_SUMMARY;

  return {
    totalValue,
    totalOrders,
    avgTicket,
    uniqueClients,
    avgItemValue,
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
            AND situation_id = '9'
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
  scope?: ClientAnalyticsScope,
): Promise<AggregateDashboardResult> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");
  const scopedClientIds = await resolveScopedClientIds(scope);

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
    fetchAggregateTopClients(currentStart, currentEnd, scopedClientIds).catch(
      () => [] as TopClientRow[],
    ),
    fetchAggregateTopClientsByAvgTicket(currentStart, currentEnd, scopedClientIds).catch(
      () => [] as TopClientRow[],
    ),
    fetchAggregateTopItemValue(currentStart, currentEnd, scopedClientIds).catch(
      () => [] as TopItemValueRow[],
    ),
    fetchAggregateInactiveClients(inactiveDays, scopedClientIds).catch((e) => {
      console.error("[aggregate] fetchAggregateInactiveClients:", e);
      return [] as InactiveClientRow[];
    }),
    fetchAggregateNewClients(currentStart, currentEnd, scopedClientIds).catch((e) => {
      console.error("[aggregate] fetchAggregateNewClients:", e);
      return [] as NewClientRow[];
    }),
    fetchSellerRanking(currentStart, currentEnd).catch(
      () => [] as SellerRankingRow[],
    ),
    fetchAllSellersPortfolioStats(inactiveDays, scopedClientIds).catch(
      () => [] as SellerPortfolioStats[],
    ),
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

// ─── Rotas focadas do Dashboard Agregado ─────────────────────────────────────

export async function getAggregateSummaryData(
  startDate?: string,
  endDate?: string,
  prevStartDateOverride?: string,
  prevEndDateOverride?: string,
): Promise<{ monthlySummary: MonthlySummary; prevMonthSummary: MonthlySummary }> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  let prevStart: string;
  let prevEnd: string;
  if (prevStartDateOverride && prevEndDateOverride) {
    prevStart = prevStartDateOverride;
    prevEnd = prevEndDateOverride;
  } else {
    const duration = differenceInCalendarDays(parseISO(currentEnd), parseISO(currentStart));
    const prevEndDate = subDays(parseISO(currentStart), 1);
    prevStart = format(subDays(prevEndDate, duration), "yyyy-MM-dd");
    prevEnd = format(prevEndDate, "yyyy-MM-dd");
  }

  const [monthlySummary, prevMonthSummary] = await Promise.all([
    fetchAggregateSummary(currentStart, currentEnd).catch(() => EMPTY_SUMMARY),
    fetchAggregateSummary(prevStart, prevEnd).catch(() => EMPTY_SUMMARY),
  ]);

  return { monthlySummary, prevMonthSummary };
}

export async function getAggregateSellerRankingData(
  startDate?: string,
  endDate?: string,
): Promise<{ sellerRanking: SellerRankingRow[] }> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  const sellerRanking = await fetchSellerRanking(currentStart, currentEnd).catch(
    () => [] as SellerRankingRow[],
  );

  return { sellerRanking };
}

export async function getAggregateTopProductsData(
  startDate?: string,
  endDate?: string,
): Promise<{ topProducts: TopProductRow[] }> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");

  const topProducts = await fetchAggregateTopProducts(currentStart, currentEnd).catch(
    () => [] as TopProductRow[],
  );

  return { topProducts };
}

export async function getAggregateTopClientsData(
  startDate?: string,
  endDate?: string,
  scope?: ClientAnalyticsScope,
): Promise<{ topClients: TopClientRow[] }> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");
  const scopedClientIds = await resolveScopedClientIds(scope);

  const topClients = await fetchAggregateTopClients(
    currentStart,
    currentEnd,
    scopedClientIds,
  ).catch(() => [] as TopClientRow[]);

  return { topClients };
}

export async function getAggregatePortfolioData(
  scope?: ClientAnalyticsScope,
): Promise<{ sellerPortfolioStats: SellerPortfolioStats[] }> {
  const [inactiveDays, scopedClientIds] = await Promise.all([
    getPurchaseStatusDays(),
    resolveScopedClientIds(scope),
  ]);

  const sellerPortfolioStats = await fetchAllSellersPortfolioStats(
    inactiveDays,
    scopedClientIds,
  ).catch(() => [] as SellerPortfolioStats[]);

  return { sellerPortfolioStats };
}

// ─────────────────────────────────────────────────────────────────────────────

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
        AND situation_id = '9'
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

  // Contar clientes únicos combinando Bling + Connect (sem duplicar quem comprou nas duas fontes)
  const uniqueClientsResult = await db.execute<{ unique_clients: unknown }>(sql`
    SELECT COUNT(DISTINCT client_id)::int AS unique_clients
    FROM (
      SELECT app_client_id::text AS client_id
      FROM bling_orders
      WHERE deleted_at IS NULL
        AND situation_id = '9'
        AND sale_date >= ${startDate}
        AND sale_date <= ${endDate}
        AND app_client_id IS NOT NULL
      UNION
      SELECT app_client_id AS client_id
      FROM connect_orders
      WHERE sale_date::date >= ${startDate}::date
        AND sale_date::date <= ${endDate}::date
        AND app_client_id IS NOT NULL
    ) _combined
  `);
  const uniqueClients = Number(uniqueClientsResult.rows[0]?.unique_clients ?? blingClients);

  return {
    totalValue,
    totalOrders,
    avgTicket,
    uniqueClients,
    avgItemValue: 0,
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
        AND situation_id = '9'
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
      AND bo.situation_id = '9'
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
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

  const connectStart = `${startDate}T00:00:00`;
  const connectEnd = `${endDate}T23:59:59`;

  const result = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  }>(sql`
    SELECT
      client_id,
      MAX(client_name)                                             AS client_name,
      SUM(order_count)::int                                        AS order_count,
      SUM(total_value)::text                                       AS total_value,
      (SUM(total_value) / NULLIF(SUM(order_count), 0))::text       AS avg_ticket
    FROM (
      SELECT
        bo.app_client_id                              AS client_id,
        MAX(COALESCE(c.name, bo.contact_name))        AS client_name,
        COUNT(*)                                      AS order_count,
        SUM(bo.total_value::numeric)                  AS total_value
      FROM bling_orders bo
      LEFT JOIN clients c ON c.id = bo.app_client_id
      WHERE bo.deleted_at IS NULL
        AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.app_client_id IS NOT NULL
        ${buildClientIdsCondition("bo.app_client_id", clientIds)}
      GROUP BY bo.app_client_id
      UNION ALL
      SELECT
        co.app_client_id                              AS client_id,
        MAX(c.name)                                   AS client_name,
        COUNT(*)                                      AS order_count,
        SUM(co.total_value::numeric)                  AS total_value
      FROM connect_orders co
      LEFT JOIN clients c ON c.id = co.app_client_id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.app_client_id IS NOT NULL
        ${buildClientIdsCondition("co.app_client_id", clientIds)}
      GROUP BY co.app_client_id
    ) _combined
    GROUP BY client_id
    ORDER BY SUM(total_value) DESC
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
  clientIds?: string[] | null,
): Promise<TopClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

  const connectStart = `${startDate}T00:00:00`;
  const connectEnd = `${endDate}T23:59:59`;

  const result = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  }>(sql`
    SELECT
      client_id,
      MAX(client_name)                                             AS client_name,
      SUM(order_count)::int                                        AS order_count,
      SUM(total_value)::text                                       AS total_value,
      (SUM(total_value) / NULLIF(SUM(order_count), 0))::text       AS avg_ticket
    FROM (
      SELECT
        bo.app_client_id                              AS client_id,
        MAX(COALESCE(c.name, bo.contact_name))        AS client_name,
        COUNT(*)                                      AS order_count,
        SUM(bo.total_value::numeric)                  AS total_value
      FROM bling_orders bo
      LEFT JOIN clients c ON c.id = bo.app_client_id
      WHERE bo.deleted_at IS NULL
        AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.app_client_id IS NOT NULL
        ${buildClientIdsCondition("bo.app_client_id", clientIds)}
      GROUP BY bo.app_client_id
      UNION ALL
      SELECT
        co.app_client_id                              AS client_id,
        MAX(c.name)                                   AS client_name,
        COUNT(*)                                      AS order_count,
        SUM(co.total_value::numeric)                  AS total_value
      FROM connect_orders co
      LEFT JOIN clients c ON c.id = co.app_client_id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.app_client_id IS NOT NULL
        ${buildClientIdsCondition("co.app_client_id", clientIds)}
      GROUP BY co.app_client_id
    ) _combined
    GROUP BY client_id
    ORDER BY (SUM(total_value) / NULLIF(SUM(order_count), 0)) DESC
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
  clientIds?: string[] | null,
): Promise<TopItemValueRow[]> {
  if (clientIds && clientIds.length === 0) return [];

  const connectStart = `${startDate}T00:00:00`;
  const connectEnd = `${endDate}T23:59:59`;

  const result = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    avg_item_value: string | null;
    item_count: unknown;
  }>(sql`
    SELECT
      client_id,
      MAX(client_name)                              AS client_name,
      AVG(item_value)::text                         AS avg_item_value,
      COUNT(*)::int                                 AS item_count
    FROM (
      SELECT
        bo.app_client_id                            AS client_id,
        COALESCE(c.name, bo.contact_name)           AS client_name,
        boi.value::numeric                          AS item_value
      FROM bling_orders bo
      JOIN bling_order_items boi ON boi.order_id = bo.id
      LEFT JOIN clients c ON c.id = bo.app_client_id
      WHERE bo.deleted_at IS NULL
        AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.app_client_id IS NOT NULL
        ${buildClientIdsCondition("bo.app_client_id", clientIds)}
      UNION ALL
      SELECT
        co.app_client_id                            AS client_id,
        c.name                                      AS client_name,
        coi.unit_value::numeric                     AS item_value
      FROM connect_orders co
      JOIN connect_order_items coi ON coi.order_id = co.id
      LEFT JOIN clients c ON c.id = co.app_client_id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.app_client_id IS NOT NULL
        ${buildClientIdsCondition("co.app_client_id", clientIds)}
    ) _combined
    WHERE client_id IS NOT NULL
    GROUP BY client_id
    ORDER BY AVG(item_value) DESC
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
  clientIds?: string[] | null,
): Promise<InactiveClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
    WHERE (${clientIds ? sql.raw(`c.id IN (${clientIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",")}) AND`) : sql``}
        (
        EXISTS (SELECT 1 FROM bling_orders bo WHERE bo.app_client_id = c.id AND bo.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM connect_orders co WHERE co.app_client_id = c.id)
      ))
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

async function fetchAggregateNewClients(
  startDate: string,
  endDate: string,
  clientIds?: string[] | null,
): Promise<NewClientRow[]> {
  if (clientIds && clientIds.length === 0) return [];

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
    WHERE created_at::date >= ${startDate}::date
      AND created_at::date <= ${endDate}::date
      ${buildClientIdsCondition("id", clientIds)}
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
  const connectStart = `${startDate}T00:00:00`;
  const connectEnd = `${endDate}T23:59:59`;

  const result = await db.execute<{
    seller_id: string | null;
    seller_name: string | null;
    total_orders: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  }>(sql`
    SELECT
      seller_id,
      MAX(seller_name)                                               AS seller_name,
      SUM(total_orders)::int                                         AS total_orders,
      SUM(total_value)::text                                         AS total_value,
      (SUM(total_value) / NULLIF(SUM(total_orders), 0))::text        AS avg_ticket
    FROM (
      SELECT
        COALESCE(u.id, bo.seller_id)                AS seller_id,
        COALESCE(u.name, bo.seller_name)             AS seller_name,
        COUNT(*)                                     AS total_orders,
        SUM(bo.total_value::numeric)                 AS total_value
      FROM bling_orders bo
      LEFT JOIN LATERAL (
        SELECT id, name FROM users WHERE bling_vendedor_id = bo.seller_id LIMIT 1
      ) u ON true
      WHERE bo.deleted_at IS NULL
        AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.seller_id IS NOT NULL
      GROUP BY COALESCE(u.id, bo.seller_id), COALESCE(u.name, bo.seller_name)
      UNION ALL
      SELECT
        co.seller_id,
        COALESCE(u.name, co.seller_name_raw, 'Desconhecido') AS seller_name,
        COUNT(*)                                               AS total_orders,
        SUM(co.total_value::numeric)                          AS total_value
      FROM connect_orders co
      LEFT JOIN users u ON co.seller_id = u.id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.seller_id IS NOT NULL
      GROUP BY co.seller_id, u.name, co.seller_name_raw
    ) _combined
    GROUP BY seller_id
    ORDER BY SUM(total_value) DESC
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
      AND bo.situation_id = '9'
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
      AND bo.situation_id = '9'
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
      AND bo.situation_id = '9'
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
      AND bo.situation_id = '9'
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
      AND bo.situation_id = '9'
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
  clientIds?: string[] | null,
): Promise<ClientPortfolioStats> {
  if (clientIds && clientIds.length === 0) {
    return { total: 0, active: 0, inactive: 0, positivacao: 0 };
  }

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
            AND bo.situation_id = '9'
            AND TO_DATE(bo.sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
        OR EXISTS (
          SELECT 1 FROM connect_orders co
          WHERE co.app_client_id = c.id
            AND co.sale_date::date >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
      )::int AS active_count
    FROM clients c
    WHERE c.responsavel_id = ${userId}
      ${buildClientIdsCondition("c.id", clientIds)}
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
  clientIds?: string[] | null,
): Promise<SellerPortfolioStats[]> {
  if (clientIds && clientIds.length === 0) return [];

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
            AND bo.situation_id = '9'
            AND TO_DATE(bo.sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
        OR EXISTS (
          SELECT 1 FROM connect_orders co
          WHERE co.app_client_id = c.id
            AND co.sale_date::date >= CURRENT_DATE - (${daysStr} || ' days')::interval
        )
      )::int                                                             AS active_count
    FROM clients c
    JOIN users u ON u.id = c.responsavel_id
    WHERE c.responsavel_id IS NOT NULL
      ${buildClientIdsCondition("c.id", clientIds)}
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
  startDate?: string,
  endDate?: string,
  userId?: string,
): Promise<PortfolioStatsResult> {
  const now = new Date();
  const currentStart = startDate ?? format(startOfMonth(now), "yyyy-MM-dd");
  const currentEnd = endDate ?? format(endOfMonth(now), "yyyy-MM-dd");
  const inactiveDays = await getPurchaseStatusDays();

  const [sellerPortfolioStats, newClientsThisMonth] = await Promise.all([
    (userId
      ? fetchClientPortfolioStats(userId, inactiveDays).then((s) => [
          { userId, sellerName: "", ...s } as SellerPortfolioStats,
        ])
      : fetchAllSellersPortfolioStats(inactiveDays)
    ).catch(() => [] as SellerPortfolioStats[]),
    (userId
      ? fetchNewClientsThisMonth(userId, currentStart, currentEnd)
      : fetchAggregateNewClients(currentStart, currentEnd)
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
