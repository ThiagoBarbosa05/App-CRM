import { Request, Response } from "express";
import { z } from "zod";
import { unifiedOrdersService } from "../../services/unified-orders.service";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseQuerySchema = z.object({
  startDate: z
    .string()
    .regex(dateRegex, "Data inicial deve estar no formato YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(dateRegex, "Data final deve estar no formato YYYY-MM-DD"),
  source: z.enum(["bling", "connect", "all"]).optional().default("all"),
});

const listQuerySchema = baseQuerySchema.extend({
  contactName: z.string().optional(),
  sellerId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const evolutionQuerySchema = baseQuerySchema.extend({
  groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
});

const topSellersQuerySchema = baseQuerySchema.extend({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

/**
 * Controller para a visão unificada de pedidos (Bling + Connect).
 */
export class UnifiedOrdersController {
  /**
   * GET /api/unified-orders
   * Lista pedidos unificados com filtros e paginação.
   */
  async listOrders(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const { data, total } = await unifiedOrdersService.listOrders({
        startDate: query.startDate,
        endDate: query.endDate,
        contactName: query.contactName,
        sellerId: query.sellerId,
        source: query.source,
        limit: query.limit,
        offset: query.offset,
      });

      return res.json({
        success: true,
        data,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + data.length < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error("[UnifiedOrdersController] Erro em listOrders:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/unified-orders/statistics/sales
   * Estatísticas de vendas somadas (total de pedidos, valor total, ticket médio).
   */
  async getSalesStatistics(req: Request, res: Response) {
    try {
      const query = baseQuerySchema.parse(req.query);
      const data = await unifiedOrdersService.getSalesStatistics(
        query.startDate,
        query.endDate,
        query.source,
      );
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error(
        "[UnifiedOrdersController] Erro em getSalesStatistics:",
        error,
      );
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/unified-orders/statistics/sales-comparison
   * Estatísticas comparadas com o período anterior de mesma duração.
   */
  async getSalesComparison(req: Request, res: Response) {
    try {
      const query = baseQuerySchema.parse(req.query);
      const data = await unifiedOrdersService.getSalesComparison(
        query.startDate,
        query.endDate,
        query.source,
      );
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error(
        "[UnifiedOrdersController] Erro em getSalesComparison:",
        error,
      );
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/unified-orders/statistics/sales-evolution
   * Evolução temporal de vendas (dia/semana/mês) unificada.
   */
  async getSalesEvolution(req: Request, res: Response) {
    try {
      const query = evolutionQuerySchema.parse(req.query);
      const data = await unifiedOrdersService.getSalesEvolution(
        query.startDate,
        query.endDate,
        query.groupBy,
        query.source,
      );
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error(
        "[UnifiedOrdersController] Erro em getSalesEvolution:",
        error,
      );
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/unified-orders/statistics/top-sellers
   * Top vendedores por valor de vendas (Bling + Connect combinados).
   */
  async getTopSellers(req: Request, res: Response) {
    try {
      const query = topSellersQuerySchema.parse(req.query);
      const data = await unifiedOrdersService.getTopSellers(
        query.startDate,
        query.endDate,
        query.limit,
        query.source,
      );
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error("[UnifiedOrdersController] Erro em getTopSellers:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }
}

export const unifiedOrdersController = new UnifiedOrdersController();
