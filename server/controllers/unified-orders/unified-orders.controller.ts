import { Request, Response } from "express";
import { z } from "zod";
import { unifiedOrdersService } from "../../services/unified-orders.service";
import { db } from "../../db";
import { users, blingSellerMappings } from "../../../shared/schema";
import { and, eq, isNotNull } from "drizzle-orm";

async function resolveBlingVendedorId(userId: string): Promise<string | undefined> {
  // 1. Tenta o campo direto na tabela users
  const [userRow] = await db
    .select({ blingVendedorId: users.blingVendedorId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow?.blingVendedorId) return userRow.blingVendedorId;

  // 2. Fallback: bling_seller_mappings (userId → blingVendedorId)
  const [mapping] = await db
    .select({ blingVendedorId: blingSellerMappings.blingVendedorId })
    .from(blingSellerMappings)
    .where(and(eq(blingSellerMappings.userId, userId), isNotNull(blingSellerMappings.blingVendedorId)))
    .limit(1);
  return mapping?.blingVendedorId ?? undefined;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseQuerySchema = z.object({
  startDate: z
    .string()
    .regex(dateRegex, "Data inicial deve estar no formato YYYY-MM-DD"),
  endDate: z
    .string()
    .regex(dateRegex, "Data final deve estar no formato YYYY-MM-DD"),
  source: z.enum(["bling", "connect", "all"]).optional().default("all"),
  prevStartDate: z
    .string()
    .regex(dateRegex, "Data inicial anterior deve estar no formato YYYY-MM-DD")
    .optional(),
  prevEndDate: z
    .string()
    .regex(dateRegex, "Data final anterior deve estar no formato YYYY-MM-DD")
    .optional(),
});

const listQuerySchema = baseQuerySchema.extend({
  contactName: z.string().optional(),
  sellerId: z.string().optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const evolutionQuerySchema = baseQuerySchema.extend({
  groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
});

const topSellersQuerySchema = baseQuerySchema.extend({
  limit: z.coerce.number().min(1).max(200).optional().default(10),
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

      let blingVendedorId: string | undefined;
      let connectUserId: string | undefined;
      let excludeBling = false;
      if (query.userId && !query.sellerId) {
        blingVendedorId = await resolveBlingVendedorId(query.userId);
        connectUserId = query.userId;
        // Se não encontrou o blingVendedorId, exclui pedidos Bling para não vazar dados de outros vendedores
        if (!blingVendedorId) excludeBling = true;
      }

      const effectiveSource = excludeBling
        ? "connect"
        : query.source;

      const { data, total } = await unifiedOrdersService.listOrders({
        startDate: query.startDate,
        endDate: query.endDate,
        contactName: query.contactName,
        sellerId: query.sellerId,
        blingVendedorId,
        connectUserId,
        source: effectiveSource,
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
        query.prevStartDate,
        query.prevEndDate,
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
