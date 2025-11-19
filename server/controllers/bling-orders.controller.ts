import { Request, Response } from "express";
import {
  blingOrdersRepository,
  type OrderFilters,
} from "../repositories/bling-orders.repository";
import { z } from "zod";

/**
 * Schema de validação para query params de listagem
 */
const listOrdersQuerySchema = z.object({
  accountId: z.string().optional(),
  userId: z.string().optional(),
  contactId: z.coerce.number().optional(),
  sellerId: z.coerce.number().optional(),
  storeId: z.coerce.number().optional(),
  situationId: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => val === "true"),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * Schema para parâmetros de rota
 */
const orderIdParamSchema = z.object({
  blingOrderId: z.coerce.number(),
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
        sellerId: query.sellerId,
        storeId: query.storeId,
        situationId: query.situationId,
        startDate: query.startDate,
        endDate: query.endDate,
        includeDeleted: query.includeDeleted,
      };

      const [orders, total] = await Promise.all([
        blingOrdersRepository.findMany(filters, query.limit, query.offset),
        blingOrdersRepository.count(filters),
      ]);

      return res.json({
        success: true,
        data: orders,
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
        params.blingOrderId
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
      const schema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        accountId: z.string().optional(),
      });

      const query = schema.parse(req.query);

      const stats = await blingOrdersRepository.getSalesStatistics(
        query.startDate,
        query.endDate,
        query.accountId
      );

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar estatísticas:",
        error
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
      const schema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        limit: z.coerce.number().min(1).max(50).optional().default(10),
      });

      const query = schema.parse(req.query);

      const topSellers = await blingOrdersRepository.getTopSellers(
        query.startDate,
        query.endDate,
        query.limit
      );

      return res.json({
        success: true,
        data: topSellers,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar top vendedores:",
        error
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
      const schema = z.object({
        startDate: z.string(),
        endDate: z.string(),
        limit: z.coerce.number().min(1).max(50).optional().default(10),
      });

      const query = schema.parse(req.query);

      const topProducts = await blingOrdersRepository.getTopProducts(
        query.startDate,
        query.endDate,
        query.limit
      );

      return res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      console.error(
        "[BlingOrdersController] Erro ao buscar top produtos:",
        error
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
}

// Instância singleton do controller
export const blingOrdersController = new BlingOrdersController();
