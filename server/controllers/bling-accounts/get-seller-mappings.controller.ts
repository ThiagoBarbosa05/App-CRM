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
    const rows = await db
      .select({
        connectionId: blingSellerMappings.connectionId,
        connectionName: blingConnections.name,
        blingVendedorId: blingSellerMappings.blingVendedorId,
        blingVendedorName: blingSellerMappings.blingVendedorName,
      })
      .from(blingSellerMappings)
      .innerJoin(blingConnections, eq(blingSellerMappings.connectionId, blingConnections.id))
      .where(eq(blingSellerMappings.userId, userId));

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("[getSellerMappingsController] Erro ao buscar mapeamentos:", error);
    return res.status(500).json({ success: false, error: "Erro ao buscar mapeamentos de vendedores" });
  }
}
