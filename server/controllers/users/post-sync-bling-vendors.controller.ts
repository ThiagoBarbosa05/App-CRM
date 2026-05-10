import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, blingSellerMappings, blingConnections } from "../../../shared/schema";

interface VendorMapping {
  userId: string | null;
  blingVendedorId: string;
  blingVendedorName: string | null;
}

export async function syncBlingVendorsController(req: Request, res: Response) {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ success: false, error: "Apenas administradores podem sincronizar vendedores" });
  }

  const { connectionId, mappings } = req.body as { connectionId: string; mappings: VendorMapping[] };

  if (!connectionId) {
    return res.status(400).json({ success: false, error: "connectionId é obrigatório" });
  }

  try {
    // Valida que a conexão existe
    const [connection] = await db
      .select({ id: blingConnections.id })
      .from(blingConnections)
      .where(eq(blingConnections.id, connectionId))
      .limit(1);

    if (!connection) {
      return res.status(404).json({ success: false, error: "Conexão Bling não encontrada" });
    }

    let updated = 0;

    for (const mapping of mappings) {
      if (!mapping.blingVendedorId) continue;

      // Upsert em blingSellerMappings (multi-conta)
      await db
        .insert(blingSellerMappings)
        .values({
          connectionId,
          blingVendedorId: mapping.blingVendedorId,
          blingVendedorName: mapping.blingVendedorName,
          userId: mapping.userId,
        })
        .onConflictDoUpdate({
          target: [blingSellerMappings.connectionId, blingSellerMappings.blingVendedorId],
          set: {
            blingVendedorName: mapping.blingVendedorName,
            userId: mapping.userId,
            updatedAt: new Date(),
          },
        });

      // Mantém retrocompatibilidade: atualiza users.blingVendedorId se userId informado
      if (mapping.userId) {
        await db
          .update(users)
          .set({ blingVendedorId: mapping.blingVendedorId, blingVendedorName: mapping.blingVendedorName, updatedAt: new Date() })
          .where(eq(users.id, mapping.userId));
      }

      updated++;
    }

    return res.json({ success: true, data: { updated } });
  } catch (error) {
    console.error("[syncBlingVendorsController] Erro ao salvar mapeamento de vendedores:", error);
    return res.status(500).json({ success: false, error: "Erro ao salvar mapeamento de vendedores" });
  }
}
