import { db } from "../db";
import { pdvUnits } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { PdvUnit, InsertPdvUnit } from "../../shared/schema";

export const pdvUnitsService = {
  async listUnits(activeOnly = false): Promise<PdvUnit[]> {
    return db
      .select()
      .from(pdvUnits)
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);
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
};
