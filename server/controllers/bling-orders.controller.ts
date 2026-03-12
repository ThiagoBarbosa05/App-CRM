import { Request, Response } from "express";
import {
  blingOrdersRepository,
  type OrderFilters,
} from "../repositories/bling-orders.repository";
import { z } from "zod";
import { cache, cacheKeys, cacheTTL } from "../lib/redis";
import { db } from "../db";
import { cashbackTransactions } from "../../shared/schema";
import { and, ne, inArray } from "drizzle-orm";

/**
 * Enriquece uma lista de pedidos com o valor de cashback correspondente.
 * Faz uma única query em lote para todos os valores, minimizando roundtrips.
 */
async function enrichWithCashback<T extends { orderNumber: string }>(
  orders: T[],
): Promise<
  (T & { cashbackAmount: string | null; cashbackRate: string | null })[]
> {
  if (orders.length === 0) {
    return orders.map((o) => ({
      ...o,
      cashbackAmount: null,
      cashbackRate: null,
    }));
  }
  try {
    const orderNumbers = orders.map((o) => o.orderNumber);
    const cashbacks = await db
      .select({
        invoiceNumber: cashbackTransactions.invoiceNumber,
        cashbackAmount: cashbackTransactions.cashbackAmount,
        cashbackRate: cashbackTransactions.cashbackRate,
      })
      .from(cashbackTransactions)
      .where(
        and(
          inArray(cashbackTransactions.invoiceNumber, orderNumbers),
          ne(cashbackTransactions.status, "cancelled"),
        ),
      );
    const cashbackMap = new Map<
      string,
      { cashbackAmount: string; cashbackRate: string }
    >();
    cashbacks.forEach((c) => {
      if (c.invoiceNumber) {
        cashbackMap.set(c.invoiceNumber, {
          cashbackAmount: c.cashbackAmount,
          cashbackRate: c.cashbackRate,
        });
      }
    });
    return orders.map((o) => ({
      ...o,
      cashbackAmount: cashbackMap.get(o.orderNumber)?.cashbackAmount ?? null,
      cashbackRate: cashbackMap.get(o.orderNumber)?.cashbackRate ?? null,
    }));
  } catch (error) {
    console.error(
      "[enrichWithCashback] Erro ao buscar cashback dos pedidos:",
      error,
    );
    return orders.map((o) => ({
      ...o,
      cashbackAmount: null,
      cashbackRate: null,
    }));
  }
}

/**
 * Schema de validação para query params de listagem
 */
const listOrdersQuerySchema = z
  .object({
    accountId: z.string().optional(),
    userId: z.string().optional(),
    contactId: z.string().optional(),
    contactName: z.string().optional(),
    contactType: z.enum(["F", "J", "E"]).optional(),
    sellerId: z.string().optional(),
    storeId: z.string().optional(),
    situationId: z.string().optional(),
    minValue: z.coerce.number().min(0).optional(),
    maxValue: z.coerce.number().min(0).optional(),
    paymentMethodId: z.string().optional(),
    startDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Data inicial deve estar no formato YYYY-MM-DD",
      )
      .optional(),
    endDate: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Data final deve estar no formato YYYY-MM-DD",
      )
      .optional(),
    includeDeleted: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => val === "true"),
    limit: z.coerce.number().min(1).max(100).optional().default(50),
    offset: z.coerce.number().min(0).optional().default(0),
  })
  .refine(
    (data) => {
      // Validar que se ambas as datas forem fornecidas, startDate <= endDate
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: "Data inicial deve ser anterior ou igual à data final",
      path: ["startDate"],
    },
  )
  .refine(
    (data) => {
      // Validar que se ambos os valores forem fornecidos, minValue <= maxValue
      if (data.minValue !== undefined && data.maxValue !== undefined) {
        return data.minValue <= data.maxValue;
      }
      return true;
    },
    {
      message: "Valor mínimo deve ser menor ou igual ao valor máximo",
      path: ["minValue"],
    },
  );

/**
 * Schema para parâmetros de rota
 * Note: blingOrderId é uma string (text no banco de dados)
 */
const orderIdParamSchema = z.object({
  blingOrderId: z.string(),
});

/**
 * Controller para operações relacionadas aos pedidos do Bling
 */
export class BlingOrdersController {
  /**
   * Lista pedidos com filtros e paginação
   * GET /api/bling-orders
   */
  async listOrders(req: Request, res: Response) {
    try {
      const query = listOrdersQuerySchema.parse(req.query);

      const filters: OrderFilters = {
        accountId: query.accountId,
        userId: query.userId,
        contactId: query.contactId,
        contactName: query.contactName,
        contactType: query.contactType,
        sellerId: query.sellerId,
        storeId: query.storeId,
        situationId: query.situationId,
        minValue: query.minValue?.toString(),
        maxValue: query.maxValue?.toString(),
        paymentMethodId: query.paymentMethodId,
        startDate: query.startDate,
        endDate: query.endDate,
        includeDeleted: query.includeDeleted,
      };

      const [orders, total] = await Promise.all([
        blingOrdersRepository.findMany(filters, query.limit, query.offset),
        blingOrdersRepository.count(filters),
      ]);

      const enrichedOrders = await enrichWithCashback(orders);

      return res.json({
        success: true,
        data: enrichedOrders,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + orders.length < total,
        },
      });
    } catch (error) {
      console.error("[BlingOrdersController] Erro ao listar pedidos:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao listar pedidos",
      });
    }
  }

  /**
   * Busca um pedido específico por ID do Bling
   * GET /api/bling-orders/:blingOrderId
   */
  async getOrderById(req: Request, res: Response) {
    try {
      const params = orderIdParamSchema.parse(req.params);

      const order = await blingOrdersRepository.findByBlingId(
        params.blingOrderId,
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Pedido não encontrado",
        });
      }

      return res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      console.error("[BlingOrdersController] Erro ao buscar pedido:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "ID inválido",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar pedido",
      });
    }
  }

  /**
   * Retorna estatísticas de vendas
   * GET /api/bling-orders/statistics/sales
   */
  async getSalesStatistics(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
          accountId: z.string().optional(),
          contactType: z.enum(["F", "J", "E"]).optional(),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      // Check cache first
      const cacheKey = cacheKeys.salesStatistics(
        query.startDate,
        query.endDate,
        query.accountId,
        query.contactType,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const stats = await blingOrdersRepository.getSalesStatistics(
        query.startDate,
        query.endDate,
        query.accountId,
        query.contactType,
      );

      // Store in cache
      await cache.set(cacheKey, stats, cacheTTL.statistics);

      return res.json({
        success: true,
        data: stats,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar estatísticas:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar estatísticas",
      });
    }
  }

  /**
   * Retorna top vendedores
   * GET /api/bling-orders/statistics/top-sellers
   */
  async getTopSellers(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
          limit: z.coerce.number().min(1).max(50).optional().default(10),
          contactType: z.enum(["F", "J", "E"]).optional(),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      // Check cache
      const cacheKey = cacheKeys.topSellers(
        query.startDate,
        query.endDate,
        query.limit,
        query.contactType,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const topSellers = await blingOrdersRepository.getTopSellers(
        query.startDate,
        query.endDate,
        query.limit,
        query.contactType,
      );

      // Store in cache
      await cache.set(cacheKey, topSellers, cacheTTL.statistics);

      return res.json({
        success: true,
        data: topSellers,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar top vendedores:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar top vendedores",
      });
    }
  }

  /**
   * Retorna produtos mais vendidos
   * GET /api/bling-orders/statistics/top-products
   */
  async getTopProducts(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
          limit: z.coerce.number().min(1).max(50).optional().default(10),
          contactType: z.enum(["F", "J", "E"]).optional(),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      // Check cache
      const cacheKey = cacheKeys.topProducts(
        query.startDate,
        query.endDate,
        query.limit,
        query.contactType,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const topProducts = await blingOrdersRepository.getTopProducts(
        query.startDate,
        query.endDate,
        query.limit,
        query.contactType,
      );

      // Store in cache
      await cache.set(cacheKey, topProducts, cacheTTL.statistics);

      return res.json({
        success: true,
        data: topProducts,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar top produtos:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar top produtos",
      });
    }
  }

  /**
   * Retorna lista de vendedores disponíveis
   * GET /api/bling-orders/filters/sellers
   */
  async getAvailableSellers(req: Request, res: Response) {
    try {
      // Check cache
      const cacheKey = cacheKeys.availableSellers();
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const sellers = await blingOrdersRepository.getAvailableSellers();

      // Store in cache
      await cache.set(cacheKey, sellers, cacheTTL.filters);

      return res.json({
        success: true,
        data: sellers,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar vendedores:",
        error,
      );

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar vendedores",
      });
    }
  }

  /**
   * Retorna lista de lojas disponíveis
   * GET /api/bling-orders/filters/stores
   */
  async getAvailableStores(req: Request, res: Response) {
    try {
      // Check cache
      const cacheKey = cacheKeys.availableStores();
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const stores = await blingOrdersRepository.getAvailableStores();

      // Store in cache
      await cache.set(cacheKey, stores, cacheTTL.filters);

      return res.json({
        success: true,
        data: stores,
        cached: false,
      });
    } catch (error) {
      console.error("[BlingOrdersController] Erro ao buscar lojas:", error);

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar lojas",
      });
    }
  }

  /**
   * Retorna lista de situações disponíveis
   * GET /api/bling-orders/filters/situations
   */
  async getAvailableSituations(req: Request, res: Response) {
    try {
      // Check cache
      const cacheKey = cacheKeys.availableSituations();
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const situations = await blingOrdersRepository.getAvailableSituations();

      // Store in cache
      await cache.set(cacheKey, situations, cacheTTL.filters);

      return res.json({
        success: true,
        data: situations,
        cached: false,
      });
    } catch (error) {
      console.error("[BlingOrdersController] Erro ao buscar situações:", error);

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar situações",
      });
    }
  }

  /**
   * Retorna lista de formas de pagamento disponíveis
   * GET /api/bling-orders/filters/payment-methods
   */
  async getAvailablePaymentMethods(req: Request, res: Response) {
    try {
      // Check cache
      const cacheKey = cacheKeys.availablePaymentMethods();
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const paymentMethods =
        await blingOrdersRepository.getAvailablePaymentMethods();

      // Store in cache
      await cache.set(cacheKey, paymentMethods, cacheTTL.filters);

      return res.json({
        success: true,
        data: paymentMethods,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar formas de pagamento:",
        error,
      );

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar formas de pagamento",
      });
    }
  }

  /**
   * Exporta pedidos com detalhes completos (itens e parcelas)
   * GET /api/bling-orders/export
   */
  async exportOrders(req: Request, res: Response) {
    try {
      const query = listOrdersQuerySchema.parse(req.query);

      const filters: OrderFilters = {
        accountId: query.accountId,
        userId: query.userId,
        contactId: query.contactId,
        contactName: query.contactName,
        contactType: query.contactType,
        sellerId: query.sellerId,
        storeId: query.storeId,
        situationId: query.situationId,
        minValue: query.minValue?.toString(),
        maxValue: query.maxValue?.toString(),
        paymentMethodId: query.paymentMethodId,
        startDate: query.startDate,
        endDate: query.endDate,
        includeDeleted: query.includeDeleted,
      };

      // Buscar pedidos com limite alto
      const orders = await blingOrdersRepository.findMany(
        filters,
        query.limit,
        query.offset,
      );

      // Buscar itens, parcelas e cashback para cada pedido
      const [ordersWithDetails, enrichedOrders] = await Promise.all([
        Promise.all(
          orders.map(async (order) => {
            const [items, installments] = await Promise.all([
              blingOrdersRepository.findOrderItems(order.id),
              blingOrdersRepository.findOrderInstallments(order.id),
            ]);
            return { ...order, items, installments };
          }),
        ),
        enrichWithCashback(orders),
      ]);

      const cashbackIndex = new Map(
        enrichedOrders.map((o) => [
          o.orderNumber,
          { cashbackAmount: o.cashbackAmount, cashbackRate: o.cashbackRate },
        ]),
      );
      const finalOrders = ordersWithDetails.map((o) => ({
        ...o,
        cashbackAmount:
          cashbackIndex.get(o.orderNumber)?.cashbackAmount ?? null,
        cashbackRate: cashbackIndex.get(o.orderNumber)?.cashbackRate ?? null,
      }));

      return res.json({
        success: true,
        data: finalOrders,
      });
    } catch (error) {
      console.error("[BlingOrdersController] Erro ao exportar pedidos:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao exportar pedidos",
      });
    }
  }

  /**
   * Retorna evolução temporal de vendas
   * GET /api/bling-orders/statistics/sales-evolution
   */
  async getSalesEvolution(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
          groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
          accountId: z.string().optional(),
          contactType: z.enum(["F", "J", "E"]).optional(),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      // Check cache
      const cacheKey = cacheKeys.salesEvolution(
        query.startDate,
        query.endDate,
        query.groupBy,
        query.accountId,
        query.contactType,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Fetch from database
      const evolution = await blingOrdersRepository.getSalesEvolution(
        query.startDate,
        query.endDate,
        query.groupBy,
        query.accountId,
        query.contactType,
      );

      // Store in cache
      await cache.set(cacheKey, evolution, cacheTTL.evolution);

      return res.json({
        success: true,
        data: evolution,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar evolução de vendas:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar evolução de vendas",
      });
    }
  }

  /**
   * Retorna estatísticas comparadas com período anterior
   * GET /api/bling-orders/statistics/sales-comparison
   */
  async getSalesComparison(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
          accountId: z.string().optional(),
          contactType: z.enum(["F", "J", "E"]).optional(),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      // Check cache
      const cacheKey = cacheKeys.salesComparison(
        query.startDate,
        query.endDate,
        query.accountId,
        query.contactType,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      // Calcular período anterior com mesma duração
      const startDate = new Date(query.startDate);
      const endDate = new Date(query.endDate);
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - daysDiff);
      const previousEndDate = new Date(endDate);
      previousEndDate.setDate(previousEndDate.getDate() - daysDiff);

      // Buscar estatísticas de ambos os períodos
      const [currentStats, previousStats] = await Promise.all([
        blingOrdersRepository.getSalesStatistics(
          query.startDate,
          query.endDate,
          query.accountId,
          query.contactType,
        ),
        blingOrdersRepository.getSalesStatistics(
          previousStartDate.toISOString().split("T")[0],
          previousEndDate.toISOString().split("T")[0],
          query.accountId,
          query.contactType,
        ),
      ]);

      // Calcular variações percentuais
      const ordersChange =
        previousStats.totalOrders > 0
          ? ((currentStats.totalOrders - previousStats.totalOrders) /
              previousStats.totalOrders) *
            100
          : 0;

      const valueChange =
        previousStats.totalValue > 0
          ? ((currentStats.totalValue - previousStats.totalValue) /
              previousStats.totalValue) *
            100
          : 0;

      const averageChange =
        previousStats.averageValue > 0
          ? ((currentStats.averageValue - previousStats.averageValue) /
              previousStats.averageValue) *
            100
          : 0;

      const result = {
        current: currentStats,
        previous: previousStats,
        changes: {
          ordersChange: Math.round(ordersChange * 100) / 100,
          valueChange: Math.round(valueChange * 100) / 100,
          averageChange: Math.round(averageChange * 100) / 100,
        },
      };

      // Store in cache
      await cache.set(cacheKey, result, cacheTTL.statistics);

      return res.json({
        success: true,
        data: result,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar comparação de vendas:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar comparação de vendas",
      });
    }
  }

  /**
   * Retorna estatísticas de cashback por período
   * GET /api/bling-orders/statistics/cashback
   */
  async getCashbackStatistics(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      const cacheKey = cacheKeys.cashbackStatistics(
        query.startDate,
        query.endDate,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({ success: true, data: cachedData, cached: true });
      }

      const stats = await blingOrdersRepository.getCashbackStatistics(
        query.startDate,
        query.endDate,
      );

      await cache.set(cacheKey, stats, cacheTTL.statistics);

      return res.json({ success: true, data: stats, cached: false });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar estatísticas de cashback:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar estatísticas de cashback",
      });
    }
  }

  /**
   * Retorna transações de cashback para um pedido específico
   * GET /api/bling-orders/:blingOrderId/cashback
   */
  async getOrderCashback(req: Request, res: Response) {
    try {
      const { blingOrderId } = orderIdParamSchema.parse(req.params);

      const order = await blingOrdersRepository.findByBlingId(blingOrderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, error: "Pedido não encontrado" });
      }

      const cashbacks = await blingOrdersRepository.getCashbackForOrder(
        order.orderNumber,
      );

      return res.json({ success: true, data: cashbacks });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar cashback do pedido:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "ID inválido",
          details: error.errors,
        });
      }

      return res
        .status(500)
        .json({ success: false, error: "Erro ao buscar cashback do pedido" });
    }
  }
  /**
   * Retorna dados de análise de cohort (retenção de clientes)
   * GET /api/bling-orders/statistics/cohort
   */
  async getCohortAnalysis(req: Request, res: Response) {
    try {
      const schema = z
        .object({
          startDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data inicial deve estar no formato YYYY-MM-DD",
            ),
          endDate: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}$/,
              "Data final deve estar no formato YYYY-MM-DD",
            ),
        })
        .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
          message: "Data inicial deve ser anterior ou igual à data final",
          path: ["startDate"],
        });

      const query = schema.parse(req.query);

      const cacheKey = cacheKeys.cohortAnalysis(
        query.startDate,
        query.endDate,
      );
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
        });
      }

      const cohortData = await blingOrdersRepository.getCohortAnalysis(
        query.startDate,
        query.endDate,
      );

      await cache.set(cacheKey, cohortData, cacheTTL.statistics);

      return res.json({
        success: true,
        data: cohortData,
        cached: false,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar análise de cohort:",
        error,
      );

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Erro ao buscar análise de cohort",
      });
    }
  }

  async getTopClients(req: Request, res: Response) {
    try {
      const schema = z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        contactType: z.string().optional(),
      });

      const query = schema.parse(req.query);

      const clients = await blingOrdersRepository.getTopClients(
        query.startDate,
        query.endDate,
        query.limit,
        query.contactType,
      );

      return res.json({
        success: true,
        data: clients.map((c, i) => ({
          rank: i + 1,
          contactId: c.contactId,
          contactName: c.contactName || "Cliente sem nome",
          totalOrders: Number(c.totalOrders),
          totalValue: Number(c.totalValue),
          avgValue: Number(c.avgValue),
          firstOrder: c.firstOrder,
          lastOrder: c.lastOrder,
        })),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: "Parâmetros inválidos", details: error.errors });
      }
      return res.status(500).json({ success: false, error: "Erro ao buscar top clientes" });
    }
  }

  async getCohortClients(req: Request, res: Response) {
    try {
      const schema = z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        cohortMonth: z.string().regex(/^\d{4}-\d{2}$/),
        monthOffset: z.coerce.number().int().min(0),
      });

      const query = schema.parse(req.query);

      const clients = await blingOrdersRepository.getCohortClients(
        query.startDate,
        query.endDate,
        query.cohortMonth,
        query.monthOffset,
      );

      return res.json({ success: true, data: clients });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      return res.status(500).json({
        success: false,
        error: "Erro ao buscar clientes do cohort",
      });
    }
  }
}

// Instância singleton do controller
export const blingOrdersController = new BlingOrdersController();
