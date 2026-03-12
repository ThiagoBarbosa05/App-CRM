import { db } from "../db";
import {
  blingOrders,
  blingOrderItems,
  blingOrderInstallments,
  pubsubProcessingLogs,
  cashbackTransactions,
  clients,
  type BlingOrder,
  type BlingOrderWithDetails,
  type PubsubProcessingLog,
  type CashbackTransaction,
} from "../../shared/schema";
import { eq, and, isNull, desc, gte, lte, sql, ilike, ne } from "drizzle-orm";

/**
 * Interface para filtros de busca de pedidos
 */
export interface OrderFilters {
  accountId?: string;
  userId?: string;
  contactId?: string;
  contactName?: string;
  contactType?: string;
  sellerId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  situationId?: string;
  minValue?: string;
  maxValue?: string;
  paymentMethodId?: string;
  includeDeleted?: boolean;
}

/**
 * Repository para operações de banco de dados relacionadas aos pedidos do Bling
 *
 * Separa a lógica de acesso a dados da lógica de negócio,
 * seguindo o padrão Repository.
 */
export class BlingOrdersRepository {
  /**
   * Busca um pedido por ID do Bling com seus relacionamentos
   */
  async findByBlingId(
    blingOrderId: string,
    includeDeleted = false,
  ): Promise<BlingOrderWithDetails | null> {
    const conditions = includeDeleted
      ? eq(blingOrders.blingOrderId, blingOrderId)
      : and(
          eq(blingOrders.blingOrderId, blingOrderId),
          isNull(blingOrders.deletedAt),
        );

    const [order] = await db
      .select()
      .from(blingOrders)
      .where(conditions)
      .limit(1);

    if (!order) {
      return null;
    }

    const items = await db
      .select()
      .from(blingOrderItems)
      .where(eq(blingOrderItems.orderId, order.id));

    const installments = await db
      .select()
      .from(blingOrderInstallments)
      .where(eq(blingOrderInstallments.orderId, order.id));

    return {
      ...order,
      items,
      installments,
    };
  }

  /**
   * Lista pedidos com filtros e paginação
   */
  async findMany(
    filters: OrderFilters,
    limit = 50,
    offset = 0,
  ): Promise<BlingOrder[]> {
    const conditions = [];

    if (filters.accountId) {
      conditions.push(eq(blingOrders.accountId, filters.accountId));
    }

    if (filters.userId) {
      conditions.push(eq(blingOrders.userId, filters.userId));
    }

    if (filters.contactId) {
      conditions.push(eq(blingOrders.contactId, filters.contactId));
    }

    if (filters.contactName) {
      conditions.push(
        ilike(blingOrders.contactName, `%${filters.contactName}%`),
      );
    }

    if (filters.contactType) {
      conditions.push(eq(blingOrders.contactType, filters.contactType));
    }

    if (filters.sellerId) {
      conditions.push(eq(blingOrders.sellerId, filters.sellerId));
    }

    if (filters.storeId) {
      conditions.push(eq(blingOrders.storeId, filters.storeId));
    }

    if (filters.situationId) {
      conditions.push(eq(blingOrders.situationId, filters.situationId));
    }

    if (filters.minValue) {
      conditions.push(gte(blingOrders.totalValue, filters.minValue));
    }

    if (filters.maxValue) {
      conditions.push(lte(blingOrders.totalValue, filters.maxValue));
    }

    if (filters.paymentMethodId) {
      conditions.push(eq(blingOrders.paymentMethodId, filters.paymentMethodId));
    }

    if (filters.startDate) {
      conditions.push(gte(blingOrders.saleDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(blingOrders.saleDate, filters.endDate));
    }

    if (!filters.includeDeleted) {
      conditions.push(isNull(blingOrders.deletedAt));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select()
      .from(blingOrders)
      .where(where)
      .orderBy(desc(blingOrders.saleDate))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Conta pedidos com filtros
   */
  async count(filters: OrderFilters): Promise<number> {
    const conditions = [];

    if (filters.accountId) {
      conditions.push(eq(blingOrders.accountId, filters.accountId));
    }

    if (filters.userId) {
      conditions.push(eq(blingOrders.userId, filters.userId));
    }

    if (filters.contactId) {
      conditions.push(eq(blingOrders.contactId, filters.contactId));
    }

    if (filters.contactName) {
      conditions.push(
        ilike(blingOrders.contactName, `%${filters.contactName}%`),
      );
    }

    if (filters.contactType) {
      conditions.push(eq(blingOrders.contactType, filters.contactType));
    }

    if (filters.sellerId) {
      conditions.push(eq(blingOrders.sellerId, filters.sellerId));
    }

    if (filters.storeId) {
      conditions.push(eq(blingOrders.storeId, filters.storeId));
    }

    if (filters.situationId) {
      conditions.push(eq(blingOrders.situationId, filters.situationId));
    }

    if (filters.minValue) {
      conditions.push(gte(blingOrders.totalValue, filters.minValue));
    }

    if (filters.maxValue) {
      conditions.push(lte(blingOrders.totalValue, filters.maxValue));
    }

    if (filters.paymentMethodId) {
      conditions.push(eq(blingOrders.paymentMethodId, filters.paymentMethodId));
    }

    if (filters.startDate) {
      conditions.push(gte(blingOrders.saleDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(blingOrders.saleDate, filters.endDate));
    }

    if (!filters.includeDeleted) {
      conditions.push(isNull(blingOrders.deletedAt));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(blingOrders)
      .where(where);

    return Number(result[0]?.count || 0);
  }

  /**
   * Busca itens de um pedido
   */
  async findOrderItems(orderId: string) {
    return await db
      .select()
      .from(blingOrderItems)
      .where(eq(blingOrderItems.orderId, orderId));
  }

  /**
   * Busca parcelas de um pedido
   */
  async findOrderInstallments(orderId: string) {
    return await db
      .select()
      .from(blingOrderInstallments)
      .where(eq(blingOrderInstallments.orderId, orderId));
  }

  /**
   * Busca logs de processamento por status
   */
  async findProcessingLogsByStatus(
    status: "processing" | "success" | "failed" | "retrying",
    limit = 100,
  ): Promise<PubsubProcessingLog[]> {
    return await db
      .select()
      .from(pubsubProcessingLogs)
      .where(eq(pubsubProcessingLogs.status, status))
      .orderBy(desc(pubsubProcessingLogs.createdAt))
      .limit(limit);
  }

  /**
   * Busca logs de processamento com falha que podem ser reprocessados
   */
  async findFailedLogsForRetry(maxAttempts = 3, limit = 50) {
    return await db
      .select()
      .from(pubsubProcessingLogs)
      .where(
        and(
          eq(pubsubProcessingLogs.status, "failed"),
          sql`${pubsubProcessingLogs.attempts} < ${maxAttempts}`,
        ),
      )
      .orderBy(desc(pubsubProcessingLogs.createdAt))
      .limit(limit);
  }

  /**
   * Calcula estatísticas de vendas por período
   */
  async getSalesStatistics(
    startDate: string,
    endDate: string,
    accountId?: string,
    contactType?: string,
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
    ];

    if (accountId) {
      conditions.push(eq(blingOrders.accountId, accountId));
    }

    if (contactType) {
      conditions.push(eq(blingOrders.contactType, contactType));
    }

    const result = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<string>`sum(${blingOrders.totalValue})`,
        averageValue: sql<string>`avg(${blingOrders.totalValue})`,
      })
      .from(blingOrders)
      .where(and(...conditions));

    return {
      totalOrders: Number(result[0]?.totalOrders || 0),
      totalValue: parseFloat(result[0]?.totalValue || "0"),
      averageValue: parseFloat(result[0]?.averageValue || "0"),
    };
  }

  /**
   * Busca top vendedores por valor de vendas
   */
  async getTopSellers(
    startDate: string,
    endDate: string,
    limit = 10,
    contactType?: string,
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
      sql`${blingOrders.sellerId} IS NOT NULL`,
    ];
    if (contactType) conditions.push(eq(blingOrders.contactType, contactType));
    return await db
      .select({
        sellerId: blingOrders.sellerId,
        sellerName: blingOrders.sellerName,
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<string>`sum(${blingOrders.totalValue})`,
      })
      .from(blingOrders)
      .where(and(...conditions))
      .groupBy(blingOrders.sellerId, blingOrders.sellerName)
      .orderBy(desc(sql`sum(${blingOrders.totalValue})`))
      .limit(limit);
  }

  /**
   * Busca produtos mais vendidos
   */
  async getTopProducts(
    startDate: string,
    endDate: string,
    limit = 10,
    contactType?: string,
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
    ];
    if (contactType) conditions.push(eq(blingOrders.contactType, contactType));
    return await db
      .select({
        productId: blingOrderItems.productId,
        productCode: blingOrderItems.productCode,
        description: blingOrderItems.description,
        totalQuantity: sql<string>`sum(${blingOrderItems.quantity})`,
        totalValue: sql<string>`sum(${blingOrderItems.value})`,
        orderCount: sql<number>`count(distinct ${blingOrderItems.orderId})`,
      })
      .from(blingOrderItems)
      .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
      .where(and(...conditions))
      .groupBy(
        blingOrderItems.productId,
        blingOrderItems.productCode,
        blingOrderItems.description,
      )
      .orderBy(desc(sql`sum(${blingOrderItems.quantity})`))
      .limit(limit);
  }

  /**
   * Lista vendedores disponíveis com contagem de pedidos
   */
  async getAvailableSellers() {
    return await db
      .select({
        sellerId: blingOrders.sellerId,
        sellerName: blingOrders.sellerName,
        orderCount: sql<number>`count(*)`,
      })
      .from(blingOrders)
      .where(
        and(
          isNull(blingOrders.deletedAt),
          sql`${blingOrders.sellerId} IS NOT NULL`,
        ),
      )
      .groupBy(blingOrders.sellerId, blingOrders.sellerName)
      .orderBy(desc(sql`count(*)`));
  }

  /**
   * Lista lojas disponíveis com contagem de pedidos
   */
  async getAvailableStores() {
    return await db
      .select({
        storeId: blingOrders.storeId,
        orderCount: sql<number>`count(*)`,
      })
      .from(blingOrders)
      .where(isNull(blingOrders.deletedAt))
      .groupBy(blingOrders.storeId)
      .orderBy(desc(sql`count(*)`));
  }

  /**
   * Lista situações disponíveis com contagem de pedidos
   */
  async getAvailableSituations() {
    return await db
      .select({
        situationId: blingOrders.situationId,
        situationValue: blingOrders.situationValue,
        orderCount: sql<number>`count(*)`,
      })
      .from(blingOrders)
      .where(
        and(
          isNull(blingOrders.deletedAt),
          sql`${blingOrders.situationId} IS NOT NULL`,
        ),
      )
      .groupBy(blingOrders.situationId, blingOrders.situationValue)
      .orderBy(desc(sql`count(*)`));
  }

  /**
   * Lista formas de pagamento disponíveis com contagem de pedidos
   */
  async getAvailablePaymentMethods() {
    return await db
      .select({
        paymentMethodId: blingOrders.paymentMethodId,
        paymentMethodName: blingOrders.paymentMethodName,
        orderCount: sql<number>`count(*)`,
      })
      .from(blingOrders)
      .where(
        and(
          isNull(blingOrders.deletedAt),
          sql`${blingOrders.paymentMethodId} IS NOT NULL`,
        ),
      )
      .groupBy(blingOrders.paymentMethodId, blingOrders.paymentMethodName)
      .orderBy(desc(sql`count(*)`));
  }

  /**
   * Busca evolução temporal de vendas (por dia, semana ou mês)
   * groupBy: 'day' | 'week' | 'month'
   */
  async getSalesEvolution(
    startDate: string,
    endDate: string,
    groupBy: "day" | "week" | "month" = "day",
    accountId?: string,
    contactType?: string,
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
    ];

    if (accountId) {
      conditions.push(eq(blingOrders.accountId, accountId));
    }

    if (contactType) {
      conditions.push(eq(blingOrders.contactType, contactType));
    }

    // Define SQL para agrupamento baseado no tipo
    let dateGroupSql;
    switch (groupBy) {
      case "week":
        dateGroupSql = sql<string>`date_trunc('week', ${blingOrders.saleDate}::timestamp)::date`;
        break;
      case "month":
        dateGroupSql = sql<string>`date_trunc('month', ${blingOrders.saleDate}::timestamp)::date`;
        break;
      case "day":
      default:
        dateGroupSql = sql<string>`${blingOrders.saleDate}`;
        break;
    }

    const result = await db
      .select({
        date: dateGroupSql,
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<string>`sum(${blingOrders.totalValue})`,
      })
      .from(blingOrders)
      .where(and(...conditions))
      .groupBy(dateGroupSql)
      .orderBy(dateGroupSql);

    return result.map((row) => ({
      date: row.date,
      totalOrders: Number(row.totalOrders),
      totalValue: parseFloat(row.totalValue || "0"),
    }));
  }

  /**
   * Retorna estatísticas de cashback vinculadas a pedidos no período
   */
  async getCashbackStatistics(startDate: string, endDate: string) {
    const dateConditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
    ];

    // Contagem de pedidos PF: total e vinculados ao app
    const [pfStats] = await db
      .select({
        totalPFOrders: sql<number>`count(*) FILTER (WHERE ${blingOrders.contactType} = 'F')`,
        linkedOrders: sql<number>`count(*) FILTER (WHERE ${blingOrders.contactType} = 'F' AND ${blingOrders.appClientId} IS NOT NULL)`,
      })
      .from(blingOrders)
      .where(and(...dateConditions));

    // Total de cashback gerado (não cancelado) vinculado a pedidos do período
    const [cashbackStats] = await db
      .select({
        totalCashback: sql<string>`COALESCE(sum(${cashbackTransactions.cashbackAmount}), 0)`,
        cashbackCount: sql<number>`count(*)`,
      })
      .from(cashbackTransactions)
      .innerJoin(
        blingOrders,
        and(
          eq(cashbackTransactions.invoiceNumber, blingOrders.orderNumber),
          gte(blingOrders.saleDate, startDate),
          lte(blingOrders.saleDate, endDate),
          isNull(blingOrders.deletedAt),
        ),
      )
      .where(ne(cashbackTransactions.status, "cancelled"));

    const totalPFOrders = Number(pfStats?.totalPFOrders || 0);
    const linkedOrders = Number(pfStats?.linkedOrders || 0);

    return {
      totalPFOrders,
      linkedOrders,
      unlinkedOrders: totalPFOrders - linkedOrders,
      totalCashbackGenerated: parseFloat(cashbackStats?.totalCashback || "0"),
      cashbackTransactionCount: Number(cashbackStats?.cashbackCount || 0),
    };
  }

  /**
   * Retorna dados de análise de cohort (retenção de clientes por mês de primeira compra)
   */
  async getCohortAnalysis(startDate: string, endDate: string) {
    const result = await db.execute(sql`
      WITH customer_orders AS (
        SELECT
          ${blingOrders.contactId},
          ${blingOrders.saleDate},
          to_char(${blingOrders.saleDate}::timestamp, 'YYYY-MM') AS order_month
        FROM ${blingOrders}
        WHERE ${blingOrders.deletedAt} IS NULL
          AND ${blingOrders.contactId} IS NOT NULL
          AND ${blingOrders.saleDate} >= ${startDate}
          AND ${blingOrders.saleDate} <= ${endDate}
      ),
      first_purchase AS (
        SELECT
          contact_id,
          MIN(order_month) AS cohort_month
        FROM customer_orders
        GROUP BY contact_id
      ),
      cohort_data AS (
        SELECT
          fp.cohort_month,
          co.order_month,
          (
            (EXTRACT(YEAR FROM to_date(co.order_month, 'YYYY-MM')) - EXTRACT(YEAR FROM to_date(fp.cohort_month, 'YYYY-MM'))) * 12
            + EXTRACT(MONTH FROM to_date(co.order_month, 'YYYY-MM')) - EXTRACT(MONTH FROM to_date(fp.cohort_month, 'YYYY-MM'))
          )::int AS month_offset,
          COUNT(DISTINCT co.contact_id) AS customer_count
        FROM customer_orders co
        JOIN first_purchase fp ON co.contact_id = fp.contact_id
        GROUP BY fp.cohort_month, co.order_month
      ),
      cohort_sizes AS (
        SELECT cohort_month, COUNT(DISTINCT contact_id) AS cohort_size
        FROM first_purchase
        GROUP BY cohort_month
      )
      SELECT
        cd.cohort_month,
        cs.cohort_size::int,
        cd.month_offset,
        cd.customer_count::int
      FROM cohort_data cd
      JOIN cohort_sizes cs ON cd.cohort_month = cs.cohort_month
      ORDER BY cd.cohort_month, cd.month_offset
    `);

    const cohortMap = new Map<string, { cohortSize: number; months: Map<number, number> }>();

    for (const row of result.rows as any[]) {
      const cohortMonth = row.cohort_month as string;
      const cohortSize = Number(row.cohort_size);
      const monthOffset = Number(row.month_offset);
      const customerCount = Number(row.customer_count);

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, { cohortSize, months: new Map() });
      }
      cohortMap.get(cohortMonth)!.months.set(monthOffset, customerCount);
    }

    const maxOffset = Math.max(
      0,
      ...Array.from(cohortMap.values()).flatMap((c) => Array.from(c.months.keys())),
    );

    const cohorts = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohortMonth, data]) => {
        const retention: { percentage: number | null; count: number | null }[] = [];
        for (let i = 0; i <= maxOffset; i++) {
          const count = data.months.get(i);
          if (count !== undefined) {
            retention.push({
              percentage:
                data.cohortSize > 0
                  ? Math.round((count / data.cohortSize) * 10000) / 100
                  : 0,
              count,
            });
          } else {
            retention.push({ percentage: null, count: null });
          }
        }
        return {
          cohortMonth,
          cohortSize: data.cohortSize,
          retention,
        };
      });

    return { cohorts, maxMonthOffset: maxOffset };
  }

  async getTopClients(
    startDate: string,
    endDate: string,
    limit = 20,
    contactType?: string,
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
      sql`${blingOrders.contactId} IS NOT NULL`,
    ];
    if (contactType) conditions.push(eq(blingOrders.contactType, contactType));

    return await db
      .select({
        contactId: blingOrders.contactId,
        contactName: blingOrders.contactName,
        totalOrders: sql<number>`count(distinct ${blingOrders.id})`,
        totalValue: sql<string>`sum(${blingOrders.totalValue})`,
        avgValue: sql<string>`avg(${blingOrders.totalValue})`,
        firstOrder: sql<string>`min(${blingOrders.saleDate})`,
        lastOrder: sql<string>`max(${blingOrders.saleDate})`,
      })
      .from(blingOrders)
      .where(and(...conditions))
      .groupBy(blingOrders.contactId, blingOrders.contactName)
      .orderBy(desc(sql`sum(${blingOrders.totalValue})`))
      .limit(limit);
  }

  async getCohortClients(
    startDate: string,
    endDate: string,
    cohortMonth: string,
    monthOffset: number,
  ) {
    const result = await db.execute(sql`
      WITH first_purchase AS (
        SELECT
          contact_id,
          contact_name,
          MIN(to_char(sale_date::timestamp, 'YYYY-MM')) AS cohort_month
        FROM ${blingOrders}
        WHERE deleted_at IS NULL
          AND contact_id IS NOT NULL
          AND sale_date >= ${startDate}
          AND sale_date <= ${endDate}
        GROUP BY contact_id, contact_name
      ),
      target_month AS (
        SELECT
          fp.contact_id,
          fp.contact_name
        FROM first_purchase fp
        WHERE fp.cohort_month = ${cohortMonth}
      ),
      returning_clients AS (
        SELECT DISTINCT
          bo.contact_id,
          bo.contact_name
        FROM ${blingOrders} bo
        JOIN first_purchase fp ON bo.contact_id = fp.contact_id
        WHERE bo.deleted_at IS NULL
          AND bo.contact_id IS NOT NULL
          AND fp.cohort_month = ${cohortMonth}
          AND (
            (EXTRACT(YEAR FROM bo.sale_date::timestamp) - EXTRACT(YEAR FROM to_date(fp.cohort_month, 'YYYY-MM'))) * 12
            + EXTRACT(MONTH FROM bo.sale_date::timestamp) - EXTRACT(MONTH FROM to_date(fp.cohort_month, 'YYYY-MM'))
          )::int = ${monthOffset}
      )
      SELECT
        tm.contact_id,
        tm.contact_name,
        CASE WHEN rc.contact_id IS NOT NULL THEN true ELSE false END AS retained
      FROM target_month tm
      LEFT JOIN returning_clients rc ON tm.contact_id = rc.contact_id
      ORDER BY retained DESC, tm.contact_name
    `);

    return (result.rows as any[]).map((row) => ({
      contactId: row.contact_id,
      contactName: row.contact_name || "Cliente sem nome",
      retained: row.retained,
    }));
  }

  /**
   * Busca transações de cashback para um pedido específico pelo número do pedido
   */
  async getCashbackForOrder(
    orderNumber: string,
  ): Promise<CashbackTransaction[]> {
    return await db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.invoiceNumber, orderNumber),
          ne(cashbackTransactions.status, "cancelled"),
        ),
      )
      .orderBy(desc(cashbackTransactions.createdAt))
      .limit(5);
  }
}

// Instância singleton do repository
export const blingOrdersRepository = new BlingOrdersRepository();
