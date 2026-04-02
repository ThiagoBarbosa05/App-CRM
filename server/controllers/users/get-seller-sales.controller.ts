import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { blingOrders, connectOrders, users } from "../../../shared/schema";
import { eq, and, gte, lte, desc, sql, count, sum } from "drizzle-orm";

const querySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  source: z.enum(["bling", "connect", "all"]).optional().default("all"),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * GET /api/users/:id/seller-sales
 * Retorna o histórico de vendas unificado (Bling + Connect) de um vendedor.
 */
export async function getSellerSalesController(req: Request, res: Response) {
  try {
    const userId = req.params.id;
    const query = querySchema.parse(req.query);
    const { startDate, endDate, source, limit, offset } = query;

    // Busca o usuário para obter o blingVendedorId
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        blingVendedorId: users.blingVendedorId,
        blingVendedorName: users.blingVendedorName,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ success: false, error: "Usuário não encontrado" });
    }

    const blingRows: {
      id: string;
      source: "bling";
      saleDate: string | null;
      totalValue: string | null;
      contactName: string | null;
      contactType: string | null;
      situationValue: string | null;
      orderNumber: string;
      sellerName: string | null;
      items: { description: string; quantity: string; value: string }[];
    }[] = [];

    const connectRows: {
      id: number;
      source: "connect";
      saleDate: string | null;
      totalValue: string | null;
      contactName: string | null;
      contactType: null;
      situationValue: null;
      orderNumber: null;
      sellerName: string | null;
      items: never[];
    }[] = [];

    // ── Vendas Bling ────────────────────────────────────────────────────
    if (source !== "connect" && user.blingVendedorId) {
      const blingConditions = [
        eq(blingOrders.sellerId, user.blingVendedorId),
        sql`${blingOrders.deletedAt} IS NULL`,
      ];
      if (startDate) {
        blingConditions.push(gte(blingOrders.saleDate, startDate));
      }
      if (endDate) {
        blingConditions.push(lte(blingOrders.saleDate, `${endDate}T23:59:59`));
      }

      const blingData = await db.query.blingOrders.findMany({
        where: and(...blingConditions),
        with: { items: true },
        orderBy: [desc(blingOrders.saleDate)],
      });

      for (const o of blingData) {
        blingRows.push({
          id: o.id.toString(),
          source: "bling",
          saleDate: o.saleDate,
          totalValue: o.totalValue,
          contactName: o.contactName,
          contactType: o.contactType,
          situationValue: o.situationValue,
          orderNumber: o.orderNumber,
          sellerName: o.sellerName,
          items: (o.items ?? []).map((item) => ({
            description: item.description ?? "",
            quantity: item.quantity ?? "0",
            value: item.value ?? "0",
          })),
        });
      }
    }

    // ── Vendas Connect ──────────────────────────────────────────────────
    if (source !== "bling") {
      const connectConditions = [eq(connectOrders.sellerId, userId)];
      if (startDate) {
        connectConditions.push(
          gte(connectOrders.saleDate, new Date(`${startDate}T00:00:00`)),
        );
      }
      if (endDate) {
        connectConditions.push(
          lte(connectOrders.saleDate, new Date(`${endDate}T23:59:59`)),
        );
      }

      const connectData = await db
        .select()
        .from(connectOrders)
        .where(and(...connectConditions))
        .orderBy(desc(connectOrders.saleDate));

      for (const o of connectData) {
        connectRows.push({
          id: o.id,
          source: "connect",
          saleDate: o.saleDate ? o.saleDate.toISOString() : null,
          totalValue: o.totalValue,
          contactName: o.contactName,
          contactType: null,
          situationValue: null,
          orderNumber: null,
          sellerName: o.sellerNameRaw,
          items: [],
        });
      }
    }

    // ── Unificação e paginação ──────────────────────────────────────────
    const allSales = ([...blingRows, ...connectRows] as {
      id: string | number;
      source: "bling" | "connect";
      saleDate: string | null;
      totalValue: string | null;
      contactName: string | null;
      contactType: string | null;
      situationValue: string | null;
      orderNumber: string | null;
      sellerName: string | null;
      items: { description: string; quantity: string; value: string }[];
    }[]).sort((a, b) => {
      const aTime = a.saleDate ? new Date(a.saleDate).getTime() : 0;
      const bTime = b.saleDate ? new Date(b.saleDate).getTime() : 0;
      return bTime - aTime;
    });

    const total = allSales.length;
    const paginated = allSales.slice(offset, offset + limit);

    // ── Totais por plataforma ───────────────────────────────────────────
    const blingTotal = blingRows.reduce(
      (acc, r) => acc + parseFloat(r.totalValue ?? "0"),
      0,
    );
    const connectTotal = connectRows.reduce(
      (acc, r) => acc + parseFloat(r.totalValue ?? "0"),
      0,
    );

    return res.json({
      success: true,
      seller: {
        id: user.id,
        name: user.name,
        blingVendedorId: user.blingVendedorId,
        blingVendedorName: user.blingVendedorName,
      },
      summary: {
        blingOrders: blingRows.length,
        blingTotal: parseFloat(blingTotal.toFixed(2)),
        connectOrders: connectRows.length,
        connectTotal: parseFloat(connectTotal.toFixed(2)),
        combinedTotal: parseFloat((blingTotal + connectTotal).toFixed(2)),
        totalOrders: total,
      },
      data: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + paginated.length < total,
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
    console.error("[getSellerSalesController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
