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
  ]);

  return {
    topClients,
    highestAvgTicket,
    highestAvgItemValue,
    inactiveClients,
    newClientsThisMonth,
  };
}

// ─── Top Clientes por valor total ──────────────────────────────────────────

async function fetchTopClientsByTotal(
  userId: string,
  blingVendedorId: string | null,
): Promise<TopClientRow[]> {
  const rows = await buildUnifiedAggQuery(userId, blingVendedorId, "total_value");
  return rows;
}

// ─── Top Clientes por ticket médio ────────────────────────────────────────

async function fetchTopClientsByAvgTicket(
  userId: string,
  blingVendedorId: string | null,
): Promise<TopClientRow[]> {
  return buildUnifiedAggQuery(userId, blingVendedorId, "avg_ticket");
}

// ─── Query base de agregação unificada ────────────────────────────────────

async function buildUnifiedAggQuery(
  userId: string,
  blingVendedorId: string | null,
  sort: "total_value" | "avg_ticket",
): Promise<TopClientRow[]> {
  type Row = {
    client_id: string | null;
    client_name: string | null;
    order_count: unknown;
    total_value: string | null;
    avg_ticket: string | null;
  };

  let result: { rows: Row[] };

  if (blingVendedorId) {
    const query = sort === "total_value"
      ? sql`
          SELECT
            u.client_id,
            COALESCE(c.name, u.contact_name) AS client_name,
            COUNT(*)::int                    AS order_count,
            SUM(u.total_value)::text         AS total_value,
            AVG(u.total_value)::text         AS avg_ticket
          FROM (
            SELECT bo.app_client_id AS client_id, bo.contact_name, bo.total_value::numeric AS total_value
            FROM bling_orders bo
            WHERE bo.seller_id = ${blingVendedorId}
              AND bo.deleted_at IS NULL
              AND bo.app_client_id IS NOT NULL
            UNION ALL
            SELECT co.app_client_id AS client_id, co.contact_name, co.total_value::numeric AS total_value
            FROM connect_orders co
            WHERE co.seller_id = ${userId}
              AND co.app_client_id IS NOT NULL
          ) u
          LEFT JOIN clients c ON c.id = u.client_id
          GROUP BY u.client_id, COALESCE(c.name, u.contact_name)
          ORDER BY SUM(u.total_value) DESC
          LIMIT 10
        `
      : sql`
          SELECT
            u.client_id,
            COALESCE(c.name, u.contact_name) AS client_name,
            COUNT(*)::int                    AS order_count,
            SUM(u.total_value)::text         AS total_value,
            AVG(u.total_value)::text         AS avg_ticket
          FROM (
            SELECT bo.app_client_id AS client_id, bo.contact_name, bo.total_value::numeric AS total_value
            FROM bling_orders bo
            WHERE bo.seller_id = ${blingVendedorId}
              AND bo.deleted_at IS NULL
              AND bo.app_client_id IS NOT NULL
            UNION ALL
            SELECT co.app_client_id AS client_id, co.contact_name, co.total_value::numeric AS total_value
            FROM connect_orders co
            WHERE co.seller_id = ${userId}
              AND co.app_client_id IS NOT NULL
          ) u
          LEFT JOIN clients c ON c.id = u.client_id
          GROUP BY u.client_id, COALESCE(c.name, u.contact_name)
          ORDER BY AVG(u.total_value) DESC
          LIMIT 10
        `;
    result = await db.execute<Row>(query);
  } else {
    // Apenas Connect
    const query = sort === "total_value"
      ? sql`
          SELECT
            co.app_client_id                 AS client_id,
            COALESCE(c.name, co.contact_name) AS client_name,
            COUNT(*)::int                     AS order_count,
            SUM(co.total_value)::text         AS total_value,
            AVG(co.total_value)::text         AS avg_ticket
          FROM connect_orders co
          LEFT JOIN clients c ON c.id = co.app_client_id
          WHERE co.seller_id = ${userId}
            AND co.app_client_id IS NOT NULL
          GROUP BY co.app_client_id, COALESCE(c.name, co.contact_name)
          ORDER BY SUM(co.total_value) DESC
          LIMIT 10
        `
      : sql`
          SELECT
            co.app_client_id                 AS client_id,
            COALESCE(c.name, co.contact_name) AS client_name,
            COUNT(*)::int                     AS order_count,
            SUM(co.total_value)::text         AS total_value,
            AVG(co.total_value)::text         AS avg_ticket
          FROM connect_orders co
          LEFT JOIN clients c ON c.id = co.app_client_id
          WHERE co.seller_id = ${userId}
            AND co.app_client_id IS NOT NULL
          GROUP BY co.app_client_id, COALESCE(c.name, co.contact_name)
          ORDER BY AVG(co.total_value) DESC
          LIMIT 10
        `;
    result = await db.execute<Row>(query);
  }

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    orderCount: Number(r.order_count ?? 0),
    totalValue: parseFloat(r.total_value ?? "0"),
    avgTicket: parseFloat(r.avg_ticket ?? "0"),
  }));
}

// ─── Top Clientes por valor médio de item ─────────────────────────────────

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
      bo.app_client_id                     AS client_id,
      COALESCE(c.name, bo.contact_name)    AS client_name,
      AVG(boi.value::numeric)::text        AS avg_item_value,
      COUNT(boi.id)::int                   AS item_count
    FROM bling_orders bo
    JOIN bling_order_items boi ON boi.order_id = bo.id
    LEFT JOIN clients c ON c.id = bo.app_client_id
    WHERE bo.seller_id = ${blingVendedorId}
      AND bo.deleted_at IS NULL
      AND bo.app_client_id IS NOT NULL
    GROUP BY bo.app_client_id, COALESCE(c.name, bo.contact_name)
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

// ─── Clientes Inativos ────────────────────────────────────────────────────

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
        SELECT MAX(d)::text FROM (
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
          SELECT MAX(d) FROM (
            SELECT TO_DATE(bo2.sale_date, 'YYYY-MM-DD') AS d
            FROM bling_orders bo2
            WHERE bo2.app_client_id = c.id AND bo2.deleted_at IS NULL
            UNION ALL
            SELECT co2.sale_date::date AS d
            FROM connect_orders co2
            WHERE co2.app_client_id = c.id
          ) dates
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
      AND NOT EXISTS (
        SELECT 1 FROM connect_orders co3
        WHERE co3.app_client_id = c.id
          AND co3.sale_date::date >= CURRENT_DATE - (${daysStr} || ' days')::interval
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

// ─── Clientes Novos no Mês ────────────────────────────────────────────────

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
      AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    ORDER BY created_at DESC
  `);

  return result.rows.map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    phone: r.phone,
    createdAt: r.created_at,
  }));
}
