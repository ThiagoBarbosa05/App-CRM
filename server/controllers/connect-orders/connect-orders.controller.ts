import { Request, Response } from "express";
import { z } from "zod";
import { connectOrdersService } from "../../services/connect-orders.service";
import { matchSellersByName } from "../../services/connect-seller-matcher.service";
import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq } from "drizzle-orm";

const importBodySchema = z.object({
  rows: z
    .array(
      z.object({
        saleDate: z.string(),
        totalValue: z.string(),
        contactName: z.string().optional().default(""),
        contactCpf: z.string().optional().default(""),
        contactBirthDate: z.string().optional().default(""),
        contactCep: z.string().optional().default(""),
        contactStreet: z.string().optional().default(""),
        contactNumber: z.string().optional().default(""),
        contactNeighborhood: z.string().optional().default(""),
        contactComplement: z.string().optional().default(""),
        contactCity: z.string().optional().default(""),
        sellerNameRaw: z.string().optional().default(""),
        contactPhone: z.string().optional().default(""),
        contactCellphone: z.string().optional().default(""),
      }),
    )
    .min(1, "Nenhuma linha encontrada no CSV"),
  sellerMappings: z.array(
    z.object({
      rawName: z.string(),
      userId: z.string().nullable(),
    }),
  ),
  sourceFile: z.string(),
});

const listQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sellerId: z.string().optional(),
  contactName: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const statsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const evolutionQuerySchema = statsQuerySchema.extend({
  groupBy: z.enum(["day", "week", "month"]).optional().default("day"),
});

const topSellersQuerySchema = statsQuerySchema.extend({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

const matchQuerySchema = z.object({
  names: z.string(), // vírgula-separado
});

export class ConnectOrdersController {
  /**
   * POST /api/connect-orders/import
   * Recebe linhas parseadas do CSV + mapeamento de vendedores e persiste no BD.
   */
  async importOrders(req: Request, res: Response) {
    try {
      const body = importBodySchema.parse(req.body);
      const importedBy = req.user!.userId;

      if (!importedBy) {
        return res.status(401).json({ success: false, error: "Não autenticado" });
      }

      const result = await connectOrdersService.importOrders({
        rows: body.rows,
        sellerMappings: body.sellerMappings,
        importedBy,
        sourceFile: body.sourceFile,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Dados inválidos",
          details: error.errors,
        });
      }
      console.error("[ConnectOrdersController] Erro ao importar:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/connect-orders
   * Lista pedidos com filtros e paginação.
   */
  async listOrders(req: Request, res: Response) {
    try {
      const query = listQuerySchema.parse(req.query);
      const { data, total } = await connectOrdersService.listOrders(query);

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
      console.error("[ConnectOrdersController] Erro ao listar:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/connect-orders/statistics/sales
   */
  async getSalesStatistics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = statsQuerySchema.parse(req.query);
      const data = await connectOrdersService.getSalesStatistics(startDate, endDate);
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error("[ConnectOrdersController] Erro em getSalesStatistics:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/connect-orders/statistics/top-sellers
   */
  async getTopSellers(req: Request, res: Response) {
    try {
      const { startDate, endDate, limit } = topSellersQuerySchema.parse(req.query);
      const data = await connectOrdersService.getTopSellers(startDate, endDate, limit);
      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error("[ConnectOrdersController] Erro em getTopSellers:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/connect-orders/statistics/sales-evolution
   */
  async getSalesEvolution(req: Request, res: Response) {
    try {
      const { startDate, endDate, groupBy } = evolutionQuerySchema.parse(req.query);
      const data = await connectOrdersService.getSalesEvolution(
        startDate,
        endDate,
        groupBy,
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
      console.error("[ConnectOrdersController] Erro em getSalesEvolution:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }

  /**
   * GET /api/connect-orders/match-sellers?names=Vera,Rogeria
   * Retorna sugestão de match para os nomes de vendedor fornecidos.
   */
  async matchSellers(req: Request, res: Response) {
    try {
      const { names } = matchQuerySchema.parse(req.query);
      const sellerNames = names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const allUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.isActive, "true"));

      const matches = matchSellersByName(sellerNames, allUsers);
      return res.json({ success: true, data: matches });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Parâmetros inválidos",
          details: error.errors,
        });
      }
      console.error("[ConnectOrdersController] Erro em matchSellers:", error);
      return res.status(500).json({ success: false, error: "Erro interno" });
    }
  }
}

export const connectOrdersController = new ConnectOrdersController();
