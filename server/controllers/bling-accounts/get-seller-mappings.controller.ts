import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { blingSellerMappings, blingConnections } from "../../../shared/schema";

export async function getSellerMappingsController(req: Request, res: Response) {
  const userRole = req.user?.role;
  if (userRole !== "admin") {
    return res.status(403).json({ success: false, error: "Apenas administradores podem consultar mapeamentos de vendedores" });
  }

  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId é obrigatório" });
  }

  try {
    const rows = await fetchSellerMappings(userId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[getSellerMappingsController] Erro ao buscar mapeamentos:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar mapeamentos de vendedores" });
  }
}

/**
 * Retorna os vínculos de vendedor Bling do próprio usuário autenticado.
 * Acessível a qualquer usuário logado (vendedor consulta os próprios vínculos).
 */
export async function getMySellerMappingsController(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: "Usuário não autenticado" });
  }

  try {
    const rows = await fetchSellerMappings(userId);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[getMySellerMappingsController] Erro ao buscar mapeamentos:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar mapeamentos de vendedores" });
  }
}

function fetchSellerMappings(userId: string) {
  return db
    .select({
      connectionId: blingSellerMappings.connectionId,
      connectionName: blingConnections.name,
      connectionStatus: blingConnections.status,
      blingVendedorId: blingSellerMappings.blingVendedorId,
      blingVendedorName: blingSellerMappings.blingVendedorName,
    })
    .from(blingSellerMappings)
    .innerJoin(blingConnections, eq(blingSellerMappings.connectionId, blingConnections.id))
    .where(eq(blingSellerMappings.userId, userId));
}
