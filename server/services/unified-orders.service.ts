import { db } from "../db";
import { sql, inArray } from "drizzle-orm";
import { connectOrderItems } from "../../shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnifiedOrderFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  contactName?: string;
  sellerId?: string;
  blingVendedorId?: string; // filtro específico para Bling (bling_orders.seller_id)
  connectUserId?: string;   // filtro específico para Connect (connect_orders.seller_id = users.id)
  source?: "bling" | "connect" | "all";
  /** Valor total mínimo do pedido (R$) */
  minValue?: number;
  /** Valor total máximo do pedido (R$) */
  maxValue?: number;
  limit?: number;
  offset?: number;
  /**
   * Filtro de situação:
   * - 'concluido'     → Bling situationId='9' + todo o Connect
   * - 'nao_concluido' → apenas Bling com situação != '9' (Connect excluído)
   */
  situation?: "concluido" | "nao_concluido";
  /** Busca parcial por número do pedido Bling (Connect não tem order_number e é excluído) */
  orderNumber?: string;
}

/**
 * Situação Bling que a analítica de vendas conta como venda concluída
 * ("Atendido"). Ver BLING_SITUACAO_PEDIDO_VENDA_ATENDIDO em integrations/bling.ts.
 */
const BLING_SITUATION_COMPLETED = "9";

export interface UnifiedOrderItem {
  id: number;
  productCode: string | null;
  productName: string | null;
  quantity: string;
  unitValue: string;
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
  saleCode: string | null;
  contactPhone: string | null;
  contactCellphone: string | null;
  connectItems: UnifiedOrderItem[];
}

export interface UnifiedSalesStatistics {
  totalOrders: number;
  totalValue: number;
  averageValue: number;
  totalItems: number;
  avgBottleValue: number;
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
  totalItems: number;
  uniqueClients: number;
}

export interface SellerTotalWithGoal {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  /** Total vendido contando apenas vendas concluídas (Bling situationId = '9') */
  totalValue: number;
  /**
   * Metas mensais (user_goals.sales_goal) rateadas pela fração de cada mês que
   * o período cobre — um filtro de 1 dia compara contra ~1/30 da meta do mês.
   * 0 se não cadastrado.
   */
  salesGoal: number;
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

/** Fragmento `AND <coluna> BETWEEN min AND max`, omitindo os limites não informados. */
function buildValueFilter(
  column: ReturnType<typeof sql>,
  minValue?: number,
  maxValue?: number,
) {
  return sql`
    ${minValue !== undefined ? sql`AND ${column}::numeric >= ${minValue}::numeric` : sql``}
    ${maxValue !== undefined ? sql`AND ${column}::numeric <= ${maxValue}::numeric` : sql``}
  `;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const unifiedOrdersService = {
  /**
   * Lista pedidos de Bling e Connect em uma única visão paginada.
   * Normaliza os campos para um shape comum; campos exclusivos de cada fonte
   * ficam como null para a outra.
   */
  async listOrders(
    filters: UnifiedOrderFilters,
  ): Promise<{ data: UnifiedOrder[]; total: number; totalValueCompleted: number }> {
    const {
      startDate,
      endDate,
      contactName,
      sellerId,
      source = "all",
      minValue,
      maxValue,
      limit = 20,
      offset = 0,
      situation,
      orderNumber,
    } = filters;

    const contactLike = contactName ? `%${contactName}%` : null;
    const blingValueFilter = buildValueFilter(sql`bo.total_value`, minValue, maxValue);
    const connectValueFilter = buildValueFilter(sql`co.total_value`, minValue, maxValue);

    // Situation filter applies only to Bling (Connect has no situation field)
    const blingSituationFilter =
      situation === "concluido"
        ? sql`AND bo.situation_id = ${BLING_SITUATION_COMPLETED}`
        : situation === "nao_concluido"
          ? sql`AND bo.situation_id != ${BLING_SITUATION_COMPLETED}`
          : sql``;

    // Order number filter applies only to Bling (Connect has no order_number)
    const blingOrderNumberFilter = orderNumber
      ? sql`AND bo.order_number ILIKE ${`%${orderNumber}%`}`
      : sql``;

    // Bling is shown unless source=connect; Connect is excluded when filtering by
    // order number (Connect has none) or by "nao_concluido" (Connect has no situation)
    const includeBling = source !== "connect";
    const includeConnect =
      source !== "bling" && !orderNumber && situation !== "nao_concluido";

    // Origem=Connect combinada com um filtro que só existe no Bling (nº do
    // pedido ou "não concluído") não deixa nenhuma fonte de pé. Sem este
    // curto-circuito o `unionFrag` cairia no `connectFrag` e devolveria todo o
    // Connect como se o filtro não tivesse sido informado.
    if (!includeBling && !includeConnect) {
      return { data: [], total: 0, totalValueCompleted: 0 };
    }

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
        COALESCE(mapped_user.name, legacy_user.name, bo.seller_name) AS seller_name,
        COALESCE(
          bsm.user_id,
          legacy_user.id,
          'bling:' || COALESCE(bo.connection_id, 'legacy') || ':' || COALESCE(bo.seller_id, 'unknown')
        )                                    AS seller_id,
        bo.app_client_id                     AS app_client_id,
        bo.situation_value                   AS situation_value,
        bo.situation_id                      AS situation_id,
        bo.contact_type                      AS contact_type,
        NULL::text                           AS app_client_status,
        NULL::text                           AS sale_code,
        NULL::text                           AS contact_phone,
        NULL::text                           AS contact_cellphone
      FROM bling_orders bo
      LEFT JOIN bling_seller_mappings bsm
        ON bo.connection_id = bsm.connection_id
       AND bo.seller_id = bsm.bling_vendedor_id
      LEFT JOIN users mapped_user ON mapped_user.id = bsm.user_id
      LEFT JOIN LATERAL (
        SELECT id, name
        FROM users
        WHERE bo.connection_id IS NULL
          AND bling_vendedor_id = bo.seller_id
        LIMIT 1
      ) legacy_user ON true
      WHERE bo.deleted_at IS NULL
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        ${contactLike !== null ? sql`AND bo.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND (bsm.user_id = ${sellerId} OR legacy_user.id = ${sellerId})` : sql``}
        ${blingValueFilter}
        ${blingSituationFilter}
        ${blingOrderNumberFilter}
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
        NULL::text                                    AS situation_id,
        'F'::text                                     AS contact_type,
        co.app_client_status                          AS app_client_status,
        co.sale_code                                  AS sale_code,
        co.contact_phone                              AS contact_phone,
        co.contact_cellphone                          AS contact_cellphone
      FROM connect_orders co
      LEFT JOIN users u ON co.seller_id = u.id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        ${contactLike !== null ? sql`AND co.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND co.seller_id = ${sellerId}` : sql``}
        ${connectValueFilter}
    `;

    const unionFrag =
      includeBling && includeConnect
        ? sql`${blingFrag} UNION ALL ${connectFrag}`
        : includeBling
          ? blingFrag
          : connectFrag;

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(
            CASE WHEN source = 'connect' OR situation_id = ${BLING_SITUATION_COMPLETED}
              THEN total_value::numeric
              ELSE 0
            END
          ), 0) AS total_value_completed
        FROM (${unionFrag}) _combined
      `),
      // O desempate por (source, id) é obrigatório: sale_date tem granularidade
      // de dia, então sem ele o LIMIT/OFFSET repete e pula pedidos entre páginas.
      db.execute(
        sql`SELECT * FROM (${unionFrag}) _combined ORDER BY sale_date DESC, source ASC, id ASC LIMIT ${limit} OFFSET ${offset}`,
      ),
    ]);

    const countRow = countResult.rows[0] as Record<string, unknown>;
    const total = Number(countRow?.total ?? 0);
    const totalValueCompleted = parseFloat(String(countRow?.total_value_completed ?? "0"));

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
      saleCode: (row.sale_code as string) ?? null,
      contactPhone: (row.contact_phone as string) ?? null,
      contactCellphone: (row.contact_cellphone as string) ?? null,
      connectItems: [],
    }));

    // Buscar itens dos pedidos Connect presentes nesta página
    const connectIds = data
      .filter((o) => o.source === "connect")
      .map((o) => parseInt(o.id, 10))
      .filter((n) => !isNaN(n));

    if (connectIds.length > 0) {
      const items = await db
        .select({
          id: connectOrderItems.id,
          orderId: connectOrderItems.orderId,
          productCode: connectOrderItems.productCode,
          productName: connectOrderItems.productName,
          quantity: connectOrderItems.quantity,
          unitValue: connectOrderItems.unitValue,
        })
        .from(connectOrderItems)
        .where(inArray(connectOrderItems.orderId, connectIds));

      const itemsByOrderId = new Map<number, UnifiedOrderItem[]>();
      for (const item of items) {
        if (!itemsByOrderId.has(item.orderId)) {
          itemsByOrderId.set(item.orderId, []);
        }
        itemsByOrderId.get(item.orderId)!.push({
          id: item.id,
          productCode: item.productCode,
          productName: item.productName,
          quantity: String(item.quantity),
          unitValue: String(item.unitValue),
        });
      }

      for (const order of data) {
        if (order.source === "connect") {
          const numericId = parseInt(order.id, 10);
          order.connectItems = itemsByOrderId.get(numericId) ?? [];
        }
      }
    }

    return { data, total, totalValueCompleted };
  },

  /**
   * Estatísticas de vendas (total de pedidos, valor total e ticket médio)
   * somando Bling + Connect de acordo com o filtro de fonte.
   */
  async getSalesStatistics(
    startDate: string,
    endDate: string,
    source: Source = "all",
    sellerId?: string,
  ): Promise<UnifiedSalesStatistics> {
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;

    const blingFrag = sql`
      SELECT
        bo.total_value::numeric AS v,
        COALESCE((
          SELECT SUM(boi.quantity)
          FROM bling_order_items boi
          WHERE boi.order_id = bo.id
        ), 0) AS items_qty
      FROM bling_orders bo
      LEFT JOIN bling_seller_mappings bsm
        ON bo.connection_id = bsm.connection_id
       AND bo.seller_id = bsm.bling_vendedor_id
      LEFT JOIN LATERAL (
        SELECT id FROM users
        WHERE bo.connection_id IS NULL
          AND bling_vendedor_id = bo.seller_id
        LIMIT 1
      ) legacy_user ON true
      WHERE bo.deleted_at IS NULL AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate} AND bo.sale_date <= ${endDate}
        ${sellerId ? sql`AND (bsm.user_id = ${sellerId} OR legacy_user.id = ${sellerId})` : sql``}
    `;

    const connectFrag = sql`
      SELECT
        co.total_value::numeric AS v,
        COALESCE((
          SELECT SUM(coi.quantity::numeric)
          FROM connect_order_items coi
          WHERE coi.order_id = co.id
        ), 0) AS items_qty
      FROM connect_orders co
      WHERE co.sale_date >= ${connectStart}::timestamp AND co.sale_date <= ${connectEnd}::timestamp
        ${sellerId ? sql`AND co.seller_id = ${sellerId}` : sql``}
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
        COALESCE(AVG(v), 0) AS avg_value,
        COALESCE(SUM(items_qty), 0) AS total_items
      FROM (${unionFrag}) _vals
    `);

    const row = result.rows[0] as Record<string, unknown>;
    const totalItems = Number(row?.total_items ?? 0);
    const totalValue = parseFloat(String(row?.total_value ?? "0"));
    return {
      totalOrders: Number(row?.total_orders ?? 0),
      totalValue,
      averageValue: parseFloat(String(row?.avg_value ?? "0")),
      totalItems,
      avgBottleValue: totalItems > 0 ? totalValue / totalItems : 0,
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
    prevStartDate?: string,
    prevEndDate?: string,
    sellerId?: string,
  ): Promise<UnifiedSalesComparison> {
    const { prevStart: defaultPrevStart, prevEnd: defaultPrevEnd } = getPreviousPeriod(startDate, endDate);
    const prevStart = prevStartDate ?? defaultPrevStart;
    const prevEnd = prevEndDate ?? defaultPrevEnd;

    const [current, previous] = await Promise.all([
      unifiedOrdersService.getSalesStatistics(startDate, endDate, source, sellerId),
      unifiedOrdersService.getSalesStatistics(prevStart, prevEnd, source, sellerId),
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
    sellerId?: string,
  ): Promise<UnifiedSalesEvolutionPoint[]> {
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;
    const blingSellerFilter = sellerId
      ? sql`AND (
          EXISTS (
            SELECT 1 FROM bling_seller_mappings bsm
            WHERE bsm.connection_id = bling_orders.connection_id
              AND bsm.bling_vendedor_id = bling_orders.seller_id
              AND bsm.user_id = ${sellerId}
          )
          OR (
            bling_orders.connection_id IS NULL
            AND EXISTS (
              SELECT 1 FROM users legacy_user
              WHERE legacy_user.bling_vendedor_id = bling_orders.seller_id
                AND legacy_user.id = ${sellerId}
            )
          )
        )`
      : sql``;
    const connectSellerFilter = sellerId
      ? sql`AND seller_id = ${sellerId}`
      : sql``;

    // DATE_TRUNC needs a literal — build per-case
    const blingFrag =
      groupBy === "month"
        ? sql`SELECT DATE_TRUNC('month', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND situation_id = '9' AND sale_date >= ${startDate} AND sale_date <= ${endDate} ${blingSellerFilter}`
        : groupBy === "week"
          ? sql`SELECT DATE_TRUNC('week', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND situation_id = '9' AND sale_date >= ${startDate} AND sale_date <= ${endDate} ${blingSellerFilter}`
          : sql`SELECT DATE_TRUNC('day', sale_date::timestamp) AS period, total_value::numeric AS v FROM bling_orders WHERE deleted_at IS NULL AND situation_id = '9' AND sale_date >= ${startDate} AND sale_date <= ${endDate} ${blingSellerFilter}`;

    const connectFrag =
      groupBy === "month"
        ? sql`SELECT DATE_TRUNC('month', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp ${connectSellerFilter}`
        : groupBy === "week"
          ? sql`SELECT DATE_TRUNC('week', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp ${connectSellerFilter}`
          : sql`SELECT DATE_TRUNC('day', sale_date) AS period, total_value::numeric AS v FROM connect_orders WHERE sale_date >= ${connectStart}::timestamp AND sale_date <= ${connectEnd}::timestamp ${connectSellerFilter}`;

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
  /**
   * Totais por vendedor (Bling + Connect) respeitando **todos** os filtros da
   * listagem principal — inclusive situação e nº do pedido, senão os cards
   * mostram um recorte diferente do da tabela.
   *
   * O valor soma apenas vendas concluídas (Bling situação '9' + Connect), a
   * mesma regra do total "Concluído" do rodapé da tabela, e acrescenta as
   * vendas lançadas manualmente em weekly_results. A meta vem rateada pela
   * fração do mês coberta pelo período.
   */
  async getSellerTotalsWithGoals(filters: {
    startDate: string;
    endDate: string;
    contactName?: string;
    sellerId?: string;
    source?: Source;
    minValue?: number;
    maxValue?: number;
    situation?: "concluido" | "nao_concluido";
    orderNumber?: string;
  }): Promise<SellerTotalWithGoal[]> {
    const {
      startDate,
      endDate,
      contactName,
      sellerId,
      source = "all",
      minValue,
      maxValue,
      situation,
      orderNumber,
    } = filters;

    const contactLike = contactName ? `%${contactName}%` : null;
    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;
    const blingValueFilter = buildValueFilter(sql`bo.total_value`, minValue, maxValue);
    const connectValueFilter = buildValueFilter(sql`co.total_value`, minValue, maxValue);

    // Mesmas regras de recorte de `listOrders` — os cards precisam enxergar
    // exatamente as mesmas linhas da tabela, senão os totais não batem.
    const blingSituationFilter =
      situation === "concluido"
        ? sql`AND bo.situation_id = ${BLING_SITUATION_COMPLETED}`
        : situation === "nao_concluido"
          ? sql`AND bo.situation_id != ${BLING_SITUATION_COMPLETED}`
          : sql``;
    const blingOrderNumberFilter = orderNumber
      ? sql`AND bo.order_number ILIKE ${`%${orderNumber}%`}`
      : sql``;

    const includeBling = source !== "connect";
    const includeConnect =
      source !== "bling" && !orderNumber && situation !== "nao_concluido";

    if (!includeBling && !includeConnect) return [];

    const blingFrag = sql`
      SELECT
        COALESCE(
          bsm.user_id,
          legacy_user.id,
          'bling:' || COALESCE(bo.connection_id, 'legacy') || ':' || bo.seller_id
        )                                AS seller_id,
        COALESCE(mapped_user.name, legacy_user.name, bo.seller_name) AS seller_name,
        'bling'::text                    AS source,
        bo.situation_id                  AS situation_id,
        bo.total_value::numeric          AS net_value
      FROM bling_orders bo
      LEFT JOIN bling_seller_mappings bsm
        ON bo.connection_id = bsm.connection_id
       AND bo.seller_id = bsm.bling_vendedor_id
      LEFT JOIN users mapped_user ON mapped_user.id = bsm.user_id
      LEFT JOIN LATERAL (
        SELECT id, name FROM users
        WHERE bo.connection_id IS NULL
          AND bling_vendedor_id = bo.seller_id
        LIMIT 1
      ) legacy_user ON true
      WHERE bo.deleted_at IS NULL
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.seller_id IS NOT NULL
        ${contactLike !== null ? sql`AND bo.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND (bsm.user_id = ${sellerId} OR legacy_user.id = ${sellerId})` : sql``}
        ${blingValueFilter}
        ${blingSituationFilter}
        ${blingOrderNumberFilter}
    `;

    const connectFrag = sql`
      SELECT
        co.seller_id                                  AS seller_id,
        COALESCE(u.name, co.seller_name_raw)          AS seller_name,
        'connect'::text                               AS source,
        NULL::text                                    AS situation_id,
        co.total_value::numeric                       AS net_value
      FROM connect_orders co
      LEFT JOIN users u ON co.seller_id = u.id
      WHERE co.sale_date >= ${connectStart}::timestamp
        AND co.sale_date <= ${connectEnd}::timestamp
        AND co.seller_id IS NOT NULL
        ${contactLike !== null ? sql`AND co.contact_name ILIKE ${contactLike}` : sql``}
        ${sellerId ? sql`AND co.seller_id = ${sellerId}` : sql``}
        ${connectValueFilter}
    `;

    const unionFrag =
      includeBling && includeConnect
        ? sql`${blingFrag} UNION ALL ${connectFrag}`
        : includeBling
          ? blingFrag
          : connectFrag;

    const result = await db.execute<{
      seller_id: string;
      seller_name: string;
      total_orders: string;
      total_value: string;
      sales_goal: string;
    }>(sql`
      WITH goal_months AS (
        -- Metas mensais que tocam o período, com a fração do mês que o período
        -- cobre (1 = mês inteiro). Filtrar um único dia não pode comparar a
        -- venda daquele dia contra a meta do mês inteiro.
        SELECT
          ug.id,
          ug.user_id,
          ug.sales_goal::numeric AS sales_goal,
          GREATEST(
            0,
            LEAST(${endDate}::date, m.month_end)
              - GREATEST(${startDate}::date, m.month_start)
              + 1
          )::numeric / (m.month_end - m.month_start + 1)::numeric AS period_ratio
        FROM user_goals ug
        CROSS JOIN LATERAL (
          SELECT
            MAKE_DATE(ug.year, ug.month, 1) AS month_start,
            (MAKE_DATE(ug.year, ug.month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS month_end
        ) m
        WHERE m.month_start >= DATE_TRUNC('month', ${startDate}::date)
          AND m.month_start <= DATE_TRUNC('month', ${endDate}::date)
      ),
      period_goals AS (
        SELECT
          user_id,
          COALESCE(SUM(sales_goal * period_ratio), 0) AS total_goal
        FROM goal_months
        GROUP BY user_id
      ),
      manual_sales AS (
        -- weekly_results só guarda a semana do mês (1-4), sem data: o mesmo
        -- rateio da meta é aplicado aqui para numerador e denominador do
        -- progresso ficarem na mesma base de tempo.
        SELECT
          gm.user_id,
          COALESCE(SUM(wr.sales_achieved::numeric * gm.period_ratio), 0) AS total_manual
        FROM goal_months gm
        JOIN weekly_results wr ON wr.goal_id = gm.id
        GROUP BY gm.user_id
      ),
      seller_totals AS (
        -- Mesma regra do rodapé "Concluído" da tabela: só Bling atendido e
        -- Connect entram no valor, mas o recorte de linhas é o dos filtros.
        SELECT
          seller_id,
          MAX(seller_name) AS seller_name,
          COUNT(*) FILTER (
            WHERE source = 'connect' OR situation_id = ${BLING_SITUATION_COMPLETED}
          )::int AS total_orders,
          COALESCE(SUM(
            CASE WHEN source = 'connect' OR situation_id = ${BLING_SITUATION_COMPLETED}
              THEN net_value
              ELSE 0
            END
          ), 0) AS total_value
        FROM (${unionFrag}) _orders
        GROUP BY seller_id
      )
      SELECT
        st.seller_id,
        st.seller_name,
        st.total_orders,
        st.total_value + COALESCE(ms.total_manual, 0) AS total_value,
        COALESCE(pg.total_goal, 0) AS sales_goal
      FROM seller_totals st
      LEFT JOIN period_goals pg ON pg.user_id = st.seller_id
      LEFT JOIN manual_sales ms ON ms.user_id = st.seller_id
      ORDER BY (st.total_value + COALESCE(ms.total_manual, 0)) DESC
    `);

    return result.rows.map((row) => ({
      sellerId: String(row.seller_id ?? ""),
      sellerName: String(row.seller_name ?? "Desconhecido"),
      totalOrders: Number(row.total_orders ?? 0),
      totalValue: parseFloat(String(row.total_value ?? "0")),
      salesGoal: parseFloat(String(row.sales_goal ?? "0")),
    }));
  },

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
        COALESCE(
          bsm.user_id,
          legacy_user.id,
          'bling:' || COALESCE(bo.connection_id, 'legacy') || ':' || bo.seller_id
        )                                  AS seller_id,
        COALESCE(mapped_user.name, legacy_user.name, bo.seller_name) AS seller_name,
        bo.total_value::numeric            AS v,
        COALESCE((
          SELECT SUM(boi.quantity)
          FROM bling_order_items boi
          WHERE boi.order_id = bo.id
        ), 0)                              AS items_qty,
        COALESCE(
          'app:' || bo.app_client_id::text,
          'bling:' || COALESCE(bo.connection_id, 'legacy') || ':' || bo.contact_id
        )                                  AS client_key
      FROM bling_orders bo
      LEFT JOIN bling_seller_mappings bsm
        ON bo.connection_id = bsm.connection_id
       AND bo.seller_id = bsm.bling_vendedor_id
      LEFT JOIN users mapped_user ON mapped_user.id = bsm.user_id
      LEFT JOIN LATERAL (
        SELECT id, name FROM users
        WHERE bo.connection_id IS NULL
          AND bling_vendedor_id = bo.seller_id
        LIMIT 1
      ) legacy_user ON true
      WHERE bo.deleted_at IS NULL
        AND bo.situation_id = '9'
        AND bo.sale_date >= ${startDate}
        AND bo.sale_date <= ${endDate}
        AND bo.seller_id IS NOT NULL
    `;

    const connectFrag = sql`
      SELECT
        co.seller_id,
        COALESCE(u.name, co.seller_name_raw, 'Desconhecido') AS seller_name,
        co.total_value::numeric AS v,
        COALESCE((
          SELECT SUM(coi.quantity::numeric)
          FROM connect_order_items coi
          WHERE coi.order_id = co.id
        ), 0)                   AS items_qty,
        co.app_client_id        AS client_key
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
        MAX(seller_name)                    AS seller_name,
        COUNT(*)                            AS total_orders,
        COALESCE(SUM(v), 0)                 AS total_value,
        COALESCE(SUM(items_qty), 0)         AS total_items,
        COUNT(DISTINCT client_key)          AS unique_clients
      FROM (${unionFrag}) _combined
      WHERE seller_id IS NOT NULL
      GROUP BY seller_id
      ORDER BY SUM(v) DESC
      LIMIT ${limit}
    `);

    return (result.rows as Record<string, unknown>[]).map((row) => ({
      sellerId: String(row.seller_id ?? ""),
      sellerName: String(row.seller_name ?? "Desconhecido"),
      totalOrders: Number(row.total_orders),
      totalValue: parseFloat(String(row.total_value ?? "0")),
      totalItems: Number(row.total_items ?? 0),
      uniqueClients: Number(row.unique_clients ?? 0),
    }));
  },
};
