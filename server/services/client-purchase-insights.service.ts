import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { blingOrderItems, blingOrders, clients, connectOrders } from "../../shared/schema";

type HistorySource = "all" | "bling" | "connect";

interface UnifiedClientOrderRow {
  source: "bling" | "connect";
  id: string;
  sale_date: string;
  total_value: string;
  contact_name: string | null;
  seller_name: string | null;
  seller_id: string | null;
  app_client_id: string | null;
  order_number: string | null;
  bling_order_id: string | null;
  situation_value: string | null;
  bling_row_id: string | null;
}

interface BlingOrderItemRow {
  orderId: string;
  productId: string | null;
  productCode: string | null;
  description: string | null;
  quantity: string;
  value: string;
}

interface ProductMixRow {
  productId: string | null;
  productCode: string | null;
  description: string | null;
  orderCount: number;
  totalQuantity: string;
  totalValue: string;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  purchaseDates: string[] | null;
}

export interface ClientPurchaseInsightsParams {
  clientId: string;
  historyLimit?: number;
  historyOffset?: number;
  historySource?: HistorySource;
}

export interface ClientPurchaseInsightsResponse {
  linkStatus: "linked" | "unlinked" | "partial";
  summary: {
    totalPurchased: number;
    purchaseCount: number;
    averageTicket: number;
    monthlyFrequency: number;
    averageDaysBetweenPurchases: number | null;
    lastPurchaseDate: string | null;
    lastPurchaseValue: number | null;
    activeMonthsLast6: number;
    activeMonthsLast12: number;
    totalItems: number;
    avgItemsPerOrder: number | null;
    avgItemPrice: number | null;
  };
  predictiveAnalysis: {
    predictedNextPurchaseDate: string | null;
    daysSinceLastPurchase: number | null;
    daysLate: number | null;
    cycleProgress: number | null;
    status:
      | "dentro_do_ciclo"
      | "atencao"
      | "reativacao"
      | "risco_de_queda"
      | "primeira_compra"
      | "sem_base";
    explanation: string;
  };
  inactiveProducts: Array<{
    productId: string | null;
    productCode: string | null;
    description: string;
    orderCount: number;
    totalQuantity: number;
    totalValue: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
    averageDaysBetweenPurchases: number | null;
    daysSinceLastPurchase: number | null;
    riskStatus: "ok" | "atencao" | "abandonado";
  }>;
  productMix: Array<{
    productId: string | null;
    productCode: string | null;
    description: string;
    orderCount: number;
    totalQuantity: number;
    totalValue: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
  }>;
  purchaseHistory: {
    data: Array<{
      id: string;
      source: "bling" | "connect";
      saleDate: string;
      totalValue: number;
      contactName: string | null;
      sellerName: string | null;
      sellerId: string | null;
      appClientId: string | null;
      orderNumber: string | null;
      blingOrderId: string | null;
      situationValue: string | null;
      items: Array<{
        productId: string | null;
        productCode: string | null;
        description: string;
        quantity: number;
        unitValue: number;
      }>;
    }>;
    total: number;
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseSaleDate(value: string): Date {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function diffInDays(later: Date, earlier: Date): number {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / DAY_IN_MS));
}

function average(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function countActiveMonthsSince(orders: Array<{ saleDate: string }>, months: number) {
  const now = new Date();
  const threshold = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return new Set(
    orders
      .filter((order) => parseSaleDate(order.saleDate) >= threshold)
      .map((order) => order.saleDate.slice(0, 7)),
  ).size;
}

function buildIntervalSeries(dates: string[]): number[] {
  if (dates.length < 2) return [];
  const sortedDates = [...dates].sort((a, b) => a.localeCompare(b));
  const intervals: number[] = [];
  for (let index = 1; index < sortedDates.length; index += 1) {
    intervals.push(
      diffInDays(parseSaleDate(sortedDates[index]), parseSaleDate(sortedDates[index - 1])),
    );
  }
  return intervals;
}

async function assertClientExists(clientId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }
}

function buildHistoryUnion(clientId: string, source: HistorySource) {
  const blingFragment = sql`
    SELECT
      'bling'::text AS source,
      bo.id::text AS id,
      bo.sale_date AS sale_date,
      bo.total_value::text AS total_value,
      bo.contact_name AS contact_name,
      bo.seller_name AS seller_name,
      bo.seller_id AS seller_id,
      bo.app_client_id AS app_client_id,
      bo.order_number AS order_number,
      bo.bling_order_id AS bling_order_id,
      bo.situation_value AS situation_value,
      bo.id::text AS bling_row_id
    FROM bling_orders bo
    WHERE bo.deleted_at IS NULL
      AND bo.app_client_id = ${clientId}
  `;

  const connectFragment = sql`
    SELECT
      'connect'::text AS source,
      co.id::text AS id,
      to_char(co.sale_date, 'YYYY-MM-DD') AS sale_date,
      co.total_value::text AS total_value,
      co.contact_name AS contact_name,
      COALESCE(u.name, co.seller_name_raw) AS seller_name,
      co.seller_id AS seller_id,
      co.app_client_id AS app_client_id,
      NULL::text AS order_number,
      NULL::text AS bling_order_id,
      NULL::text AS situation_value,
      NULL::text AS bling_row_id
    FROM connect_orders co
    LEFT JOIN users u ON co.seller_id = u.id
    WHERE co.app_client_id = ${clientId}
  `;

  if (source === "bling") return blingFragment;
  if (source === "connect") return connectFragment;
  return sql`${blingFragment} UNION ALL ${connectFragment}`;
}

async function listPurchaseHistory(params: Required<Pick<ClientPurchaseInsightsParams, "clientId" | "historyLimit" | "historyOffset" | "historySource">>) {
  const unionQuery = buildHistoryUnion(params.clientId, params.historySource);

  const [countResult, dataResult] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS total FROM (${unionQuery}) AS orders_union`),
    db.execute(
      sql`SELECT * FROM (${unionQuery}) AS orders_union ORDER BY sale_date DESC LIMIT ${params.historyLimit} OFFSET ${params.historyOffset}`,
    ),
  ]);

  const rows = dataResult.rows as Record<string, unknown>[];
  const total = Number((countResult.rows[0] as Record<string, unknown> | undefined)?.total ?? 0);

  const blingRowIds = rows
    .map((row) => (typeof row.bling_row_id === "string" ? row.bling_row_id : null))
    .filter((value): value is string => value !== null);

  const itemsByOrderId = new Map<string, ClientPurchaseInsightsResponse["purchaseHistory"]["data"][number]["items"]>();

  if (blingRowIds.length > 0) {
    const itemRows = await db
      .select({
        orderId: blingOrderItems.orderId,
        productId: blingOrderItems.productId,
        productCode: blingOrderItems.productCode,
        description: blingOrderItems.description,
        quantity: blingOrderItems.quantity,
        value: blingOrderItems.value,
      })
      .from(blingOrderItems)
      .where(inArray(blingOrderItems.orderId, blingRowIds));

    for (const itemRow of itemRows as BlingOrderItemRow[]) {
      const currentItems = itemsByOrderId.get(itemRow.orderId) ?? [];
      currentItems.push({
        productId: itemRow.productId,
        productCode: itemRow.productCode,
        description: itemRow.description ?? "Item sem descrição",
        quantity: Number(itemRow.quantity ?? 0),
        unitValue: Number(itemRow.value ?? 0),
      });
      itemsByOrderId.set(itemRow.orderId, currentItems);
    }
  }

  return {
    data: rows.map((row) => ({
      id: String(row.id ?? ""),
      source: row.source as "bling" | "connect",
      saleDate: String(row.sale_date ?? ""),
      totalValue: Number(row.total_value ?? 0),
      contactName: (row.contact_name as string | null) ?? null,
      sellerName: (row.seller_name as string | null) ?? null,
      sellerId: (row.seller_id as string | null) ?? null,
      appClientId: (row.app_client_id as string | null) ?? null,
      orderNumber: (row.order_number as string | null) ?? null,
      blingOrderId: (row.bling_order_id as string | null) ?? null,
      situationValue: (row.situation_value as string | null) ?? null,
      items: itemsByOrderId.get(String(row.bling_row_id ?? "")) ?? [],
    })),
    total,
    hasMore: params.historyOffset + rows.length < total,
    limit: params.historyLimit,
    offset: params.historyOffset,
  };
}

async function listAllOrderMetrics(clientId: string) {
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT bo.sale_date AS sale_date, bo.total_value::text AS total_value
      FROM bling_orders bo
      WHERE bo.deleted_at IS NULL
        AND bo.app_client_id = ${clientId}
      UNION ALL
      SELECT to_char(co.sale_date, 'YYYY-MM-DD') AS sale_date, co.total_value::text AS total_value
      FROM connect_orders co
      WHERE co.app_client_id = ${clientId}
    ) AS orders_union
    ORDER BY sale_date ASC
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => ({
    saleDate: String(row.sale_date ?? ""),
    totalValue: Number(row.total_value ?? 0),
  }));
}

async function listProductMix(clientId: string) {
  const result = await db.execute(sql`
    SELECT
      boi.product_id AS "productId",
      boi.product_code AS "productCode",
      boi.description AS description,
      COUNT(DISTINCT boi.order_id)::int AS "orderCount",
      COALESCE(SUM(boi.quantity), 0)::text AS "totalQuantity",
      COALESCE(SUM(boi.value), 0)::text AS "totalValue",
      MIN(bo.sale_date) AS "firstPurchaseDate",
      MAX(bo.sale_date) AS "lastPurchaseDate",
      ARRAY_AGG(DISTINCT bo.sale_date ORDER BY bo.sale_date) AS "purchaseDates"
    FROM bling_order_items boi
    INNER JOIN bling_orders bo ON boi.order_id = bo.id
    WHERE bo.deleted_at IS NULL
      AND bo.app_client_id = ${clientId}
    GROUP BY boi.product_id, boi.product_code, boi.description
    ORDER BY COALESCE(SUM(boi.value), 0) DESC, COALESCE(SUM(boi.quantity), 0) DESC
  `);

  return result.rows as unknown as ProductMixRow[];
}

function buildSummary(allOrders: Array<{ saleDate: string; totalValue: number }>) {
  if (allOrders.length === 0) {
    return {
      totalPurchased: 0,
      purchaseCount: 0,
      averageTicket: 0,
      monthlyFrequency: 0,
      averageDaysBetweenPurchases: null,
      lastPurchaseDate: null,
      lastPurchaseValue: null,
      activeMonthsLast6: 0,
      activeMonthsLast12: 0,
    };
  }

  const totalPurchased = allOrders.reduce((sum, order) => sum + order.totalValue, 0);
  const purchaseCount = allOrders.length;
  const intervals = buildIntervalSeries(allOrders.map((order) => order.saleDate));
  const firstPurchase = parseSaleDate(allOrders[0].saleDate);
  const lastPurchase = parseSaleDate(allOrders[allOrders.length - 1].saleDate);
  const monthsObserved = Math.max(
    1,
    (lastPurchase.getFullYear() - firstPurchase.getFullYear()) * 12 +
      (lastPurchase.getMonth() - firstPurchase.getMonth()) +
      1,
  );

  return {
    totalPurchased: roundTo(totalPurchased),
    purchaseCount,
    averageTicket: roundTo(totalPurchased / purchaseCount),
    monthlyFrequency: roundTo(purchaseCount / monthsObserved, 1),
    averageDaysBetweenPurchases: average(intervals),
    lastPurchaseDate: allOrders[allOrders.length - 1].saleDate,
    lastPurchaseValue: roundTo(allOrders[allOrders.length - 1].totalValue),
    activeMonthsLast6: countActiveMonthsSince(allOrders, 6),
    activeMonthsLast12: countActiveMonthsSince(allOrders, 12),
  };
}

function buildPredictiveAnalysis(summary: ClientPurchaseInsightsResponse["summary"]) {
  if (!summary.lastPurchaseDate) {
    return {
      predictedNextPurchaseDate: null,
      daysSinceLastPurchase: null,
      daysLate: null,
      cycleProgress: null,
      status: "sem_base" as const,
      explanation: "O cliente ainda não tem histórico suficiente para prever o próximo ciclo de compra.",
    };
  }

  if (summary.purchaseCount === 1) {
    const lastPurchaseDate = parseSaleDate(summary.lastPurchaseDate);
    const daysSinceLastPurchase = diffInDays(new Date(), lastPurchaseDate);
    return {
      predictedNextPurchaseDate: null,
      daysSinceLastPurchase,
      daysLate: null,
      cycleProgress: null,
      status: "primeira_compra" as const,
      explanation: `Cliente com apenas uma compra registrada. Ainda não há ciclo de recompra para análise preditiva. Há ${daysSinceLastPurchase} dia(s) desde a primeira compra.`,
    };
  }

  if (summary.averageDaysBetweenPurchases === null) {
    return {
      predictedNextPurchaseDate: null,
      daysSinceLastPurchase: null,
      daysLate: null,
      cycleProgress: null,
      status: "sem_base" as const,
      explanation: "O cliente ainda não tem histórico suficiente para prever o próximo ciclo de compra.",
    };
  }

  const lastPurchaseDate = parseSaleDate(summary.lastPurchaseDate);
  const averageCycle = Math.max(1, Math.round(summary.averageDaysBetweenPurchases));
  const now = new Date();
  const predictedDate = new Date(lastPurchaseDate.getTime() + averageCycle * DAY_IN_MS);
  const daysSinceLastPurchase = diffInDays(now, lastPurchaseDate);
  const daysLate = daysSinceLastPurchase - averageCycle;
  const cycleProgress = Math.round((daysSinceLastPurchase / averageCycle) * 100);

  let status: ClientPurchaseInsightsResponse["predictiveAnalysis"]["status"] = "dentro_do_ciclo";
  if (daysSinceLastPurchase > averageCycle * 1.5) {
    status = summary.activeMonthsLast6 <= Math.max(1, summary.activeMonthsLast12 / 2)
      ? "risco_de_queda"
      : "reativacao";
  } else if (daysSinceLastPurchase > averageCycle * 1.1) {
    status = "atencao";
  }

  const atrasoText = daysLate > 0
    ? ` — ${daysLate} dia(s) além do ciclo habitual`
    : ` — dentro do prazo esperado`;
  const mesesText = summary.activeMonthsLast12 > 0
    ? ` Ativo em ${summary.activeMonthsLast6} dos últimos 6 meses (${summary.activeMonthsLast12} nos últimos 12).`
    : "";

  return {
    predictedNextPurchaseDate: formatDateOnly(predictedDate),
    daysSinceLastPurchase,
    daysLate,
    cycleProgress,
    status,
    explanation: `Compra a cada ${averageCycle} dia(s) em média. Há ${daysSinceLastPurchase} dia(s) sem comprar${atrasoText}.${mesesText}`,
  };
}

function buildProductAnalytics(productRows: ProductMixRow[]) {
  const now = new Date();

  const productMix = productRows.map((product) => ({
    productId: product.productId,
    productCode: product.productCode,
    description: product.description ?? "Produto sem descrição",
    orderCount: Number(product.orderCount ?? 0),
    totalQuantity: Number(product.totalQuantity ?? 0),
    totalValue: Number(product.totalValue ?? 0),
    firstPurchaseDate: product.firstPurchaseDate,
    lastPurchaseDate: product.lastPurchaseDate,
  }));

  const inactiveProducts = productRows
    .map((product) => {
      const purchaseDates = Array.isArray(product.purchaseDates) ? product.purchaseDates : [];
      const intervals = buildIntervalSeries(purchaseDates);
      const averageDaysBetweenPurchases = average(intervals);
      const lastPurchaseDate = product.lastPurchaseDate ? parseSaleDate(product.lastPurchaseDate) : null;
      const daysSinceLastPurchase = lastPurchaseDate ? diffInDays(now, lastPurchaseDate) : null;

      let riskStatus: "ok" | "atencao" | "abandonado" = "ok";
      if (Number(product.orderCount ?? 0) >= 2 && averageDaysBetweenPurchases !== null && daysSinceLastPurchase !== null) {
        if (daysSinceLastPurchase > averageDaysBetweenPurchases * 2) {
          riskStatus = "abandonado";
        } else if (daysSinceLastPurchase > averageDaysBetweenPurchases * 1.5) {
          riskStatus = "atencao";
        }
      }

      return {
        productId: product.productId,
        productCode: product.productCode,
        description: product.description ?? "Produto sem descrição",
        orderCount: Number(product.orderCount ?? 0),
        totalQuantity: Number(product.totalQuantity ?? 0),
        totalValue: Number(product.totalValue ?? 0),
        firstPurchaseDate: product.firstPurchaseDate,
        lastPurchaseDate: product.lastPurchaseDate,
        averageDaysBetweenPurchases,
        daysSinceLastPurchase,
        riskStatus,
      };
    })
    .filter((product) => product.riskStatus !== "ok")
    .sort((left, right) => {
      const riskWeight = { abandonado: 2, atencao: 1, ok: 0 };
      return (
        riskWeight[right.riskStatus] - riskWeight[left.riskStatus] ||
        right.totalValue - left.totalValue
      );
    });

  return { productMix, inactiveProducts };
}

export const clientPurchaseInsightsService = {
  async getInsights(params: ClientPurchaseInsightsParams): Promise<ClientPurchaseInsightsResponse> {
    const historyLimit = params.historyLimit ?? 10;
    const historyOffset = params.historyOffset ?? 0;
    const historySource = params.historySource ?? "all";

    await assertClientExists(params.clientId);

    const [allOrders, purchaseHistory, productRows] = await Promise.all([
      listAllOrderMetrics(params.clientId),
      listPurchaseHistory({
        clientId: params.clientId,
        historyLimit,
        historyOffset,
        historySource,
      }),
      listProductMix(params.clientId),
    ]);

    const summary = buildSummary(allOrders);
    const predictiveAnalysis = buildPredictiveAnalysis(summary);
    const { productMix, inactiveProducts } = buildProductAnalytics(productRows);

    const totalItems = productRows.reduce((sum, row) => sum + Number(row.totalQuantity ?? 0), 0);
    const totalItemValue = productRows.reduce((sum, row) => sum + Number(row.totalValue ?? 0), 0);
    const avgItemsPerOrder = summary.purchaseCount > 0 && totalItems > 0
      ? roundTo(totalItems / summary.purchaseCount, 1)
      : null;
    const avgItemPrice = totalItems > 0
      ? roundTo(totalItemValue / totalItems)
      : null;

    const linkStatus: ClientPurchaseInsightsResponse["linkStatus"] =
      allOrders.length === 0 ? "unlinked" : predictiveAnalysis.status === "sem_base" ? "partial" : "linked";

    return {
      linkStatus,
      summary: {
        ...summary,
        averageDaysBetweenPurchases:
          summary.averageDaysBetweenPurchases === null
            ? null
            : roundTo(summary.averageDaysBetweenPurchases, 1),
        totalItems,
        avgItemsPerOrder,
        avgItemPrice,
      },
      predictiveAnalysis,
      inactiveProducts: inactiveProducts.map((product) => ({
        ...product,
        averageDaysBetweenPurchases:
          product.averageDaysBetweenPurchases === null
            ? null
            : roundTo(product.averageDaysBetweenPurchases, 1),
      })),
      productMix,
      purchaseHistory,
    };
  },
};
