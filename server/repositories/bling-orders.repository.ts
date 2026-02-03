import { db } from "../db";
import {
  blingOrders,
  blingOrderItems,
  blingOrderInstallments,
  pubsubProcessingLogs,
  type BlingOrder,
  type BlingOrderWithDetails,
  type PubsubProcessingLog,
} from "../../shared/schema";
import { eq, and, isNull, desc, gte, lte, sql, ilike } from "drizzle-orm";

/**
 * Interface para filtros de busca de pedidos
 */
export interface OrderFilters {
  accountId?: string;
  userId?: string;
  contactId?: string;
  contactName?: string;
  sellerId?: string;
  storeId?: string;
  startDate?: string;
  endDate?: string;
  situationId?: string;
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
    includeDeleted = false
  ): Promise<BlingOrderWithDetails | null> {
    const conditions = includeDeleted
      ? eq(blingOrders.blingOrderId, blingOrderId)
      : and(
          eq(blingOrders.blingOrderId, blingOrderId),
          isNull(blingOrders.deletedAt)
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
    offset = 0
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
      conditions.push(ilike(blingOrders.contactName, `%${filters.contactName}%`));
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
      conditions.push(ilike(blingOrders.contactName, `%${filters.contactName}%`));
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
    limit = 100
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
          sql`${pubsubProcessingLogs.attempts} < ${maxAttempts}`
        )
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
    accountId?: string
  ) {
    const conditions = [
      gte(blingOrders.saleDate, startDate),
      lte(blingOrders.saleDate, endDate),
      isNull(blingOrders.deletedAt),
    ];

    if (accountId) {
      conditions.push(eq(blingOrders.accountId, accountId));
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
  async getTopSellers(startDate: string, endDate: string, limit = 10) {
    return await db
      .select({
        sellerId: blingOrders.sellerId,
        sellerName: blingOrders.sellerName,
        totalOrders: sql<number>`count(*)`,
        totalValue: sql<string>`sum(${blingOrders.totalValue})`,
      })
      .from(blingOrders)
      .where(
        and(
          gte(blingOrders.saleDate, startDate),
          lte(blingOrders.saleDate, endDate),
          isNull(blingOrders.deletedAt),
          sql`${blingOrders.sellerId} IS NOT NULL`
        )
      )
      .groupBy(blingOrders.sellerId, blingOrders.sellerName)
      .orderBy(desc(sql`sum(${blingOrders.totalValue})`))
      .limit(limit);
  }

  /**
   * Busca produtos mais vendidos
   */
  async getTopProducts(startDate: string, endDate: string, limit = 10) {
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
      .where(
        and(
          gte(blingOrders.saleDate, startDate),
          lte(blingOrders.saleDate, endDate),
          isNull(blingOrders.deletedAt)
        )
      )
      .groupBy(
        blingOrderItems.productId,
        blingOrderItems.productCode,
        blingOrderItems.description
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
          sql`${blingOrders.sellerId} IS NOT NULL`
        )
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
          sql`${blingOrders.situationId} IS NOT NULL`
        )
      )
      .groupBy(blingOrders.situationId, blingOrders.situationValue)
      .orderBy(desc(sql`count(*)`));
  }
}

// Instância singleton do repository
export const blingOrdersRepository = new BlingOrdersRepository();
