import { db } from "../db";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnifiedOrderFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  contactName?: string;
  sellerId?: string;
  source?: "bling" | "connect" | "all";
  limit?: number;
  offset?: number;
}

export interface UnifiedOrder {
  id: string;
  source: "bling" | "connect";
  saleDate: string;
  totalValue: string;
  contactName: string | null;
  sellerName: string | null;
  sellerId: string | null;
  appClientId: string | null;
  // bling-only
  orderNumber: string | null;
  blingOrderId: string | null;
  situationValue: string | null;
  contactType: string | null;
  // connect-only
  appClientStatus: string | null;
}

export interface UnifiedSalesStatistics {
  totalOrders: number;
  totalValue: number;
  averageValue: number;
}

export interface UnifiedSalesComparison {
  current: UnifiedSalesStatistics;
  previous: UnifiedSalesStatistics;
  changes: {
    ordersChange: number;
    valueChange: number;
    averageChange: number;
  };
}

export interface UnifiedSalesEvolutionPoint {
  period: string;
  totalOrders: number;
  totalValue: number;
}

export interface UnifiedTopSeller {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getPreviousPeriod(
  startDate: string,
  endDate: string,
): { prevStart: string; prevEnd: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // +1 day so the span includes both endpoints
  const spanMs = end.getTime() - start.getTime() + 86_400_000;
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - spanMs + 86_400_000);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) };
}

type Source = "bling" | "connect" | "all";

// ─── Service ──────────────────────────────────────────────────────────────────

export const unifiedOrdersService = {
  /**
   * Lista pedidos de Bling e Connect em uma única visão paginada.
   * Normaliza os campos para um shape comum; campos exclusivos de cada fonte
   * ficam como null para a outra.
   */
  async listOrders(
    filters: UnifiedOrderFilters,
  ): Promise<{ data: UnifiedOrder[]; total: number }> {
    const {
      startDate,
      endDate,
      contactName,
      sellerId,
      source = "all",
      limit = 20,
      offset = 0,
    } = filters;

    const contactLike = contactName ? `%${contactName}%` : null;

    // ── Bling fragment (sale_date is text YYYY-MM-DD) ─────────────────────
    const blingFrag = sql`
      SELECT
        'bling'::text                        AS source,
        bo.id                                AS id,
        bo.bling_order_id                    AS bling_order_id,
        bo.order_number                      AS order_number,
        bo.sale_date                         AS sale_date,
        bo.total_value::text                 AS total_value,
        bo.contact_name                      AS contact_name,
        bo.seller_name                       AS seller_name,
        bo.seller_id                         AS seller_id,
        bo.app_client_id                     AS app_client_id,
        bo.situation_value                   AS situation_value,
        bo.contact_type                      AS contact_type,
        NULL::text                           AS app_client_status
      FROM bling_orders bo
      WHERE bo.deleted_at IS NULL
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        ${contactLike !== null ? sql`AND bo.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND bo.seller_id = ${sellerId}` : sql``}
    `;

    // ── Connect fragment (sale_date is timestamp) ─────────────────────────
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;

    const connectFrag = sql`
      SELECT
        'connect'::text                               AS source,
        co.id::text                                   AS id,
        NULL::text                                    AS bling_order_id,
        NULL::text                                    AS order_number,
        to_char(co.sale_date, 'YYYY-MM-DD')           AS sale_date,
        co.total_value::text                          AS total_value,
        co.contact_name                               AS contact_name,
        COALESCE(u.name, co.seller_name_raw)          AS seller_name,
        co.seller_id                                  AS seller_id,
        co.app_client_id                              AS app_client_id,
        NULL::text                                    AS situation_value,
        'F'::text                                     AS contact_type,
        co.app_client_status                          AS app_client_status
      FROM connect_orders co
      LEFT JOIN users u ON co.seller_id = u.id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        ${contactLike !== null ? sql`AND co.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND co.seller_id = ${sellerId}` : sql``}
    `;

    const unionFrag =
      source === "bling"
        ? blingFrag
        : source === "connect"
          ? connectFrag
          : sql`${blingFrag} UNION ALL ${connectFrag}`;

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) AS total FROM (${unionFrag}) _combined`),
      db.execute(
        sql`SELECT * FROM (${unionFrag}) _combined ORDER BY sale_date DESC LIMIT ${limit} OFFSET ${offset}`,
      ),
    ]);

    const total = Number(
      (countResult.rows[0] as Record<string, unknown>)?.total ?? 0,
    );

    const data: UnifiedOrder[] = (
      dataResult.rows as Record<string, unknown>[]
    ).map((row) => ({
      id: String(row.id ?? ""),
      source: row.source as "bling" | "connect",
      saleDate: String(row.sale_date ?? ""),
      totalValue: String(row.total_value ?? "0"),
      contactName: (row.contact_name as string) ?? null,
      sellerName: (row.seller_name as string) ?? null,
      sellerId: (row.seller_id as string) ?? null,
      appClientId: (row.app_client_id as string) ?? null,
      orderNumber: (row.order_number as string) ?? null,
      blingOrderId: (row.bling_order_id as string) ?? null,
      situationValue: (row.situation_value as string) ?? null,
      contactType: (row.contact_type as string) ?? null,
      appClientStatus: (row.app_client_status as string) ?? null,
    }));

    return { data, total };
  },

  /**
   * Estatísticas de vendas (total de pedidos, valor total e ticket médio)
   * somando Bling + Connect de acordo com o filtro de fonte.
   */
  async getSalesStatistics(
    startDate: string,
    endDate: string,
    source: Source = "all",
  ): Promise<UnifiedSalesStatistics> {
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;

    const blingFrag = sql`
      SELECT total_value::numeric AS v FROM bling_orders
      WHERE deleted_at IS NULL AND sale_date >= ${startDate} AND sale_date <= ${endDate}
    `;

    const connectFrag = sql`
      SELECT total_value::numeric AS v FROM connect_orders
      WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp
    `;

    const unionFrag =
      source === "bling"
        ? blingFrag
        : source === "connect"
          ? connectFrag
          : sql`${blingFrag} UNION ALL ${connectFrag}`;

    const result = await db.execute(sql`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(v), 0) AS total_value,
        COALESCE(AVG(v), 0) AS avg_value
      FROM (${unionFrag}) _vals
    `);

    const row = result.rows[0] as Record<string, unknown>;
    return {
      totalOrders: Number(row?.total_orders ?? 0),
      totalValue: parseFloat(String(row?.total_value ?? "0")),
      averageValue: parseFloat(String(row?.avg_value ?? "0")),
    };
  },

  /**
   * Comparação das estatísticas do período atual com o período anterior
   * de mesma duração.
   */
  async getSalesComparison(
    startDate: string,
    endDate: string,
    source: Source = "all",
  ): Promise<UnifiedSalesComparison> {
    const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

    const [current, previous] = await Promise.all([
      unifiedOrdersService.getSalesStatistics(startDate, endDate, source),
      unifiedOrdersService.getSalesStatistics(prevStart, prevEnd, source),
    ]);

    return {
      current,
      previous,
      changes: {
        ordersChange: calcChange(current.totalOrders, previous.totalOrders),
        valueChange: calcChange(current.totalValue, previous.totalValue),
        averageChange: calcChange(current.averageValue, previous.averageValue),
      },
    };
  },

  /**
   * Evolução temporal de vendas agrupada por dia, semana ou mês.
   * Combina Bling + Connect em um único eixo de tempo.
   */
  async getSalesEvolution(
    startDate: string,
    endDate: string,
    groupBy: "day" | "week" | "month" = "day",
    source: Source = "all",
  ): Promise<UnifiedSalesEvolutionPoint[]> {
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;

    // DATE_TRUNC needs a literal — build per-case
    const blingFrag =
      groupBy === "month"
        ? sql`SELECT DATE_TRUNC('month', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND sale_date >= ${startDate} AND sale_date <= ${endDate}`
        : groupBy === "week"
          ? sql`SELECT DATE_TRUNC('week', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND sale_date >= ${startDate} AND sale_date <= ${endDate}`
          : sql`SELECT DATE_TRUNC('day', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND sale_date >= ${startDate} AND sale_date <= ${endDate}`;

    const connectFrag =
      groupBy === "month"
        ? sql`SELECT DATE_TRUNC('month', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp`
        : groupBy === "week"
          ? sql`SELECT DATE_TRUNC('week', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp`
          : sql`SELECT DATE_TRUNC('day', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp`;

    const unionFrag =
      source === "bling"
        ? blingFrag
        : source === "connect"
          ? connectFrag
          : sql`${blingFrag} UNION ALL ${connectFrag}`;

    const result = await db.execute(sql`
      SELECT
        period,
        COUNT(*) AS total_orders,
        COALESCE(SUM(v), 0) AS total_value
      FROM (${unionFrag}) _combined
      GROUP BY period
      ORDER BY period
    `);

    return (result.rows as Record<string, unknown>[]).map((row) => ({
      period: String(row.period),
      totalOrders: Number(row.total_orders),
      totalValue: parseFloat(String(row.total_value ?? "0")),
    }));
  },

  /**
   * Top vendedores unificados (Bling + Connect), agrupados por sellerId.
   * Vendedores do Bling usam o nome armazenado no pedido;
   * vendedores do Connect fazem JOIN com a tabela de usuários.
   */
  async getTopSellers(
    startDate: string,
    endDate: string,
    limit = 10,
    source: Source = "all",
  ): Promise<UnifiedTopSeller[]> {
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;

    const blingFrag = sql`
      SELECT
        COALESCE(u.id, bo.seller_id) AS seller_id,
        COALESCE(u.name, bo.seller_name) AS seller_name,
        bo.total_value::numeric AS v
      FROM bling_orders bo
      LEFT JOIN users u ON u.bling_vendedor_id = bo.seller_id
      WHERE bo.deleted_at IS NULL
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.seller_id IS NOT NULL
    `;

    const connectFrag = sql`
      SELECT
        co.seller_id,
        COALESCE(u.name, co.seller_name_raw, 'Desconhecido') AS seller_name,
        co.total_value::numeric AS v
      FROM connect_orders co
      LEFT JOIN users u ON co.seller_id = u.id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.seller_id IS NOT NULL
    `;

    const unionFrag =
      source === "bling"
        ? blingFrag
        : source === "connect"
          ? connectFrag
          : sql`${blingFrag} UNION ALL ${connectFrag}`;

    const result = await db.execute(sql`
      SELECT
        seller_id,
        seller_name,
        COUNT(*) AS total_orders,
        COALESCE(SUM(v), 0) AS total_value
      FROM (${unionFrag}) _combined
      WHERE seller_id IS NOT NULL
      GROUP BY seller_id, seller_name
      ORDER BY SUM(v) DESC
      LIMIT ${limit}
    `);

    return (result.rows as Record<string, unknown>[]).map((row) => ({
      sellerId: String(row.seller_id ?? ""),
      sellerName: String(row.seller_name ?? "Desconhecido"),
      totalOrders: Number(row.total_orders),
      totalValue: parseFloat(String(row.total_value ?? "0")),
    }));
  },
};
