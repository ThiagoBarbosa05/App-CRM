import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../../shared/schema";

interface VendorMapping {
  userId: string;
  blingVendedorId: string | null;
  blingVendedorName: string | null;
}

export async function syncBlingVendorsController(req: Request, res: Response) {
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (userRole !== "admin") {
    return res.status(403).json({ success: false, error: "Apenas administradores podem sincronizar vendedores" });
  }

  const { mappings } = req.body as { mappings: VendorMapping[] };

  try {
    let updated = 0;

    for (const mapping of mappings) {
      const result = await db
        .update(users)
        .set({ blingVendedorId: mapping.blingVendedorId, blingVendedorName: mapping.blingVendedorName, updatedAt: new Date() })
        .where(eq(users.id, mapping.userId));

      if (result.rowCount && result.rowCount > 0) {
        updated++;
      }
    }

    return res.json({ success: true, data: { updated } });
  } catch (error) {
    console.error("[syncBlingVendorsController] Erro ao salvar mapeamento de vendedores:", error);
    return res.status(500).json({ success: false, error: "Erro ao salvar mapeamento de vendedores" });
  }
}
