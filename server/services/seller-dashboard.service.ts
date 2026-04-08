import { sql } from "drizzle-orm";
import { db } from "../db";
import { systemSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

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

export interface SellerDashboardResult {
  topClients: TopClientRow[];
  highestAvgTicket: TopClientRow[];
  highestAvgItemValue: TopItemValueRow[];
  inactiveClients: InactiveClientRow[];
  newClientsThisMonth: NewClientRow[];
}

async function getPurchaseStatusDays(): Promise<number> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "purchase_status_days"));
  const days = parseInt(row?.value ?? "60", 10);
  return isNaN(days) || days <= 0 ? 60 : days;
}

export async function getSellerDashboard(
  userId: string,
  blingVendedorId: string | null,
): Promise<SellerDashboardResult> {
  const inactiveDays = await getPurchaseStatusDays();

  const [
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
  ] = await Promise.all([
    fetchTopClients(userId, blingVendedorId, "total_value"),
    fetchTopClients(userId, blingVendedorId, "avg_ticket"),
    fetchTopItemValue(blingVendedorId),
    fetchInactiveClients(userId, inactiveDays),
    fetchNewClientsThisMonth(userId),
  ]);

  return {
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
  };
}

// ─── Top Clients por valor total ou ticket médio ────────────────────────────

async function fetchTopClients(
  userId: string,
  blingVendedorId: string | null,
  orderBy: "total_value" | "avg_ticket",
): Promise<TopClientRow[]> {
  // Monta a parte Bling da UNION somente se o vendedor tem blingVendedorId
  const blingPart = blingVendedorId
    ? sql`
        SELECT
          bo.app_client_id   AS client_id,
          bo.contact_name    AS contact_name,
          bo.total_value::numeric AS total_value
        FROM bling_orders bo
        WHERE bo.seller_id = ${blingVendedorId}
          AND bo.deleted_at IS NULL
          AND bo.app_client_id IS NOT NULL
      `
    : sql`SELECT NULL::varchar AS client_id, NULL::text AS contact_name, NULL::numeric AS total_value WHERE false`;

  const rows = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    order_count: string;
    total_value: string;
    avg_ticket: string;
  }>(sql`
    WITH unified AS (
      ${blingPart}
      UNION ALL
      SELECT
        co.app_client_id   AS client_id,
        co.contact_name    AS contact_name,
        co.total_value::numeric AS total_value
      FROM connect_orders co
      WHERE co.seller_id = ${userId}
        AND co.app_client_id IS NOT NULL
    ),
    aggregated AS (
      SELECT
        u.client_id,
        COALESCE(c.name, u.contact_name) AS client_name,
        COUNT(*)::int                    AS order_count,
        SUM(u.total_value)               AS total_value,
        AVG(u.total_value)               AS avg_ticket
      FROM unified u
      LEFT JOIN clients c ON c.id = u.client_id
      GROUP BY u.client_id, COALESCE(c.name, u.contact_name)
    )
    SELECT *
    FROM aggregated
    ORDER BY ${orderBy === "total_value" ? sql`total_value DESC` : sql`avg_ticket DESC`}
    LIMIT 10
  `);

  return rows.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    orderCount: parseInt(r.order_count, 10),
    totalValue: parseFloat(r.total_value ?? "0"),
    avgTicket: parseFloat(r.avg_ticket ?? "0"),
  }));
}

// ─── Top Clientes por valor médio de item ──────────────────────────────────

async function fetchTopItemValue(
  blingVendedorId: string | null,
): Promise<TopItemValueRow[]> {
  if (!blingVendedorId) return [];

  const rows = await db.execute<{
    client_id: string | null;
    client_name: string | null;
    avg_item_value: string;
    item_count: string;
  }>(sql`
    SELECT
      bo.app_client_id                     AS client_id,
      COALESCE(c.name, bo.contact_name)    AS client_name,
      AVG(boi.value::numeric)              AS avg_item_value,
      COUNT(boi.id)::int                   AS item_count
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.seller_id = ${blingVendedorId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
    GROUP BY bo.app_client_id, COALESCE(c.name, bo.contact_name)
    ORDER BY avg_item_value DESC
    LIMIT 10
  `);

  return rows.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    avgItemValue: parseFloat(r.avg_item_value ?? "0"),
    itemCount: parseInt(r.item_count, 10),
  }));
}

// ─── Clientes Inativos ──────────────────────────────────────────────────────

async function fetchInactiveClients(
  userId: string,
  inactiveDays: number,
): Promise<InactiveClientRow[]> {
  const rows = await db.execute<{
    client_id: string;
    client_name: string;
    phone: string | null;
    last_purchase_date: string | null;
    days_since_purchase: string | null;
  }>(sql`
    SELECT
      c.id   AS client_id,
      c.name AS client_name,
      c.phone,
      (
        SELECT MAX(dates.d)::text
        FROM (
          SELECT TO_DATE(bo2.sale_date, 'YYYY-MM-DD') AS d
          FROM bling_orders bo2
          WHERE bo2.app_client_id = c.id AND bo2.deleted_at IS NULL
          UNION ALL
          SELECT co2.sale_date::date AS d
          FROM connect_orders co2
          WHERE co2.app_client_id = c.id
        ) dates
      ) AS last_purchase_date,
      (
        CURRENT_DATE - (
          SELECT MAX(dates.d)
          FROM (
            SELECT TO_DATE(bo2.sale_date, 'YYYY-MM-DD') AS d
            FROM bling_orders bo2
            WHERE bo2.app_client_id = c.id AND bo2.deleted_at IS NULL
            UNION ALL
            SELECT co2.sale_date::date AS d
            FROM connect_orders co2
            WHERE co2.app_client_id = c.id
          ) dates
        )
      )::int AS days_since_purchase
    FROM clients c
    WHERE c.responsavel_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM (
          SELECT app_client_id FROM bling_orders
          WHERE app_client_id = c.id
            AND deleted_at IS NULL
            AND TO_DATE(sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${String(inactiveDays)} || ' days')::interval
          UNION ALL
          SELECT app_client_id FROM connect_orders
          WHERE app_client_id = c.id
            AND sale_date::date >= CURRENT_DATE - (${String(inactiveDays)} || ' days')::interval
        ) p
      )
    ORDER BY days_since_purchase DESC NULLS LAST
    LIMIT 50
  `);

  return rows.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    lastPurchaseDate: r.last_purchase_date,
    daysSincePurchase: r.days_since_purchase != null ? parseInt(String(r.days_since_purchase), 10) : null,
  }));
}

// ─── Clientes Novos no Mês ─────────────────────────────────────────────────

async function fetchNewClientsThisMonth(userId: string): Promise<NewClientRow[]> {
  const rows = await db.execute<{
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
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    ORDER BY created_at DESC
  `);

  return rows.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    createdAt: r.created_at,
  }));
}
