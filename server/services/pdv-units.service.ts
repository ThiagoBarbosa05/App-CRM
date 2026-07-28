import { db } from "../db";
import { pdvUnits, blingConnections, blingProductMappings, blingSellerMappings, users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import type { PdvUnit, InsertPdvUnit } from "../../shared/schema";

/** Usuário local elegível a ser o vendedor padrão da unidade para uma conexão Bling. */
export type EligibleSeller = {
  id: string;
  name: string;
  email: string;
  blingVendedorId: string;
  blingVendedorName: string | null;
};

/** Unidade + qual conta Bling ela usa e quantos produtos do CRM estão nesse catálogo. */
export type PdvUnitWithCatalog = PdvUnit & {
  blingAccountName: string | null;
  blingProductCount: number;
};

export const pdvUnitsService = {
  async listUnits(activeOnly = false): Promise<PdvUnit[]> {
    return db
      .select()
      .from(pdvUnits)
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);
  },

  async listUnitsWithCatalog(activeOnly = false): Promise<PdvUnitWithCatalog[]> {
    const counts = db
      .select({
        connectionId: blingProductMappings.connectionId,
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(blingProductMappings)
      .groupBy(blingProductMappings.connectionId)
      .as("counts");

    const rows = await db
      .select({
        unit: pdvUnits,
        // blingAccountName é preenchido no OAuth; cai para o nome da conexão quando ausente.
        blingAccountName: sql<
          string | null
        >`coalesce(${blingConnections.blingAccountName}, ${blingConnections.name})`,
        blingProductCount: sql<number>`coalesce(${counts.total}, 0)`,
      })
      .from(pdvUnits)
      .leftJoin(blingConnections, eq(blingConnections.id, pdvUnits.blingConnectionId))
      .leftJoin(counts, eq(counts.connectionId, pdvUnits.blingConnectionId))
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);

    return rows.map(({ unit, blingAccountName, blingProductCount }) => ({
      ...unit,
      blingAccountName,
      blingProductCount,
    }));
  },

  async getUnit(id: string): Promise<PdvUnit | null> {
    const [unit] = await db
      .select()
      .from(pdvUnits)
      .where(eq(pdvUnits.id, id))
      .limit(1);
    return unit ?? null;
  },

  async createUnit(data: InsertPdvUnit): Promise<PdvUnit> {
    const [created] = await db.insert(pdvUnits).values(data).returning();
    return created;
  },

  async updateUnit(id: string, data: Partial<InsertPdvUnit>): Promise<PdvUnit | null> {
    const [updated] = await db
      .update(pdvUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pdvUnits.id, id))
      .returning();
    return updated ?? null;
  },

  async deactivateUnit(id: string): Promise<void> {
    await db
      .update(pdvUnits)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(pdvUnits.id, id));
  },

  /** Usuários já mapeados como vendedor Bling para a conexão informada. */
  async listEligibleSellers(connectionId: string): Promise<EligibleSeller[]> {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        blingVendedorId: blingSellerMappings.blingVendedorId,
        blingVendedorName: blingSellerMappings.blingVendedorName,
      })
      .from(blingSellerMappings)
      .innerJoin(users, eq(users.id, blingSellerMappings.userId))
      .where(eq(blingSellerMappings.connectionId, connectionId))
      .orderBy(users.name);
  },
};
