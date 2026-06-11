import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { users, blingSellerMappings, blingConnections } from "../../../shared/schema";

interface ConnectionMapping {
  connectionId: string;
  blingVendedorId: string | null;
  blingVendedorName?: string | null;
}

export async function putBlingSellerMappingsController(req: Request, res: Response) {
  const userRole = req.user?.role;
  if (userRole !== "admin") {
    return res.status(403).json({ success: false, error: "Apenas administradores podem alterar mapeamentos de vendedores" });
  }

  const { id: userId } = req.params;
  const { connectionMappings } = req.body as { connectionMappings: ConnectionMapping[] };

  if (!Array.isArray(connectionMappings)) {
    return res.status(400).json({ success: false, error: "connectionMappings deve ser um array" });
  }

  try {
    for (const mapping of connectionMappings) {
      const [connection] = await db
        .select({ id: blingConnections.id })
        .from(blingConnections)
        .where(eq(blingConnections.id, mapping.connectionId))
        .limit(1);

      if (!connection) continue;

      if (mapping.blingVendedorId) {
        await db
          .insert(blingSellerMappings)
          .values({
            connectionId: mapping.connectionId,
            blingVendedorId: mapping.blingVendedorId,
            blingVendedorName: mapping.blingVendedorName ?? null,
            userId,
          })
          .onConflictDoUpdate({
            target: [blingSellerMappings.connectionId, blingSellerMappings.blingVendedorId],
            set: {
              userId,
              blingVendedorName: mapping.blingVendedorName ?? null,
              updatedAt: new Date(),
            },
          });
      } else {
        await db
          .delete(blingSellerMappings)
          .where(
            and(
              eq(blingSellerMappings.connectionId, mapping.connectionId),
              eq(blingSellerMappings.userId, userId),
            ),
          );
      }
    }

    // Retrocompatibilidade: atualiza users.blingVendedorId com o primeiro vínculo não-nulo
    const firstLink = connectionMappings.find((m) => !!m.blingVendedorId);
    await db
      .update(users)
      .set({
        blingVendedorId: firstLink?.blingVendedorId ?? null,
        blingVendedorName: firstLink?.blingVendedorName ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return res.json({ success: true });
  } catch (error) {
    console.error("[putBlingSellerMappingsController] Erro ao salvar mapeamentos:", error);
    return res.status(500).json({ success: false, error: "Erro ao salvar mapeamentos de vendedores" });
  }
}
