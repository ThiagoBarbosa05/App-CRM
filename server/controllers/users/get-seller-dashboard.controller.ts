import { Request, Response } from "express";
import { db } from "../../db";
import { users, blingSellerMappings } from "../../../shared/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { getSellerDashboard } from "../../services/seller-dashboard.service";
import { clientsService } from "../../services/clients.service";

async function resolveBlingVendedorId(userId: string): Promise<string | null> {
  const [userRow] = await db
    .select({ blingVendedorId: users.blingVendedorId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow?.blingVendedorId) return userRow.blingVendedorId;

  const [mapping] = await db
    .select({ blingVendedorId: blingSellerMappings.blingVendedorId })
    .from(blingSellerMappings)
    .where(and(eq(blingSellerMappings.userId, userId), isNotNull(blingSellerMappings.blingVendedorId)))
    .limit(1);
  return mapping?.blingVendedorId ?? null;
}

/**
 * GET /api/users/:id/seller-dashboard
 * Retorna métricas do Dashboard Vendedor: top clientes, ticket médio,
 * valor de item médio, clientes inativos e novos no mês.
 */
export async function getSellerDashboardController(req: Request, res: Response) {
  try {
    const userId = req.params.id;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        blingVendedorId: users.blingVendedorId,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ success: false, error: "Usuário não encontrado" });
    }

    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const prevStartDate = typeof req.query.prevStartDate === "string" ? req.query.prevStartDate : undefined;
    const prevEndDate = typeof req.query.prevEndDate === "string" ? req.query.prevEndDate : undefined;
    const { userId: requestUserId, userRole: requestUserRole, filters } =
      clientsService.processRequestParams(req);

    const blingVendedorId = await resolveBlingVendedorId(user.id);

    const data = await getSellerDashboard(
      user.id,
      blingVendedorId,
      startDate,
      endDate,
      {
        requestUserId,
        requestUserRole,
        filterUserId: user.id,
        filters,
      },
      prevStartDate,
      prevEndDate,
    );

    return res.json({ success: true, seller: { id: user.id, name: user.name }, ...data });
  } catch (error) {
    console.error("[getSellerDashboardController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
