import { Request, Response } from "express";
import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { getSellerDashboard } from "../../services/seller-dashboard.service";

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

    const data = await getSellerDashboard(user.id, user.blingVendedorId ?? null);

    return res.json({ success: true, seller: { id: user.id, name: user.name }, ...data });
  } catch (error) {
    console.error("[getSellerDashboardController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
