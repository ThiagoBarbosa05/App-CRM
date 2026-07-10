import { db } from "server/db";
import {
  automationRules,
  type InsertAutomationRule,
  type AutomationRule,
} from "@shared/schema";
import { asc, desc, eq } from "drizzle-orm";

export async function listAutomationRules(): Promise<AutomationRule[]> {
  return db
    .select()
    .from(automationRules)
    .orderBy(asc(automationRules.sortOrder), desc(automationRules.createdAt));
}

export async function reorderAutomationRules(
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(automationRules)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(automationRules.id, id)),
    ),
  );
}

export async function getAutomationRuleById(
  id: string,
): Promise<AutomationRule | null> {
  const [row] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, id));
  return row ?? null;
}

export async function listActiveAutomationRulesByTrigger(
  trigger: AutomationRule["trigger"],
): Promise<AutomationRule[]> {
  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.trigger, trigger));
  return rows.filter((r) => r.isActive);
}

export async function createAutomationRule(
  data: InsertAutomationRule,
): Promise<AutomationRule> {
  const [created] = await db.insert(automationRules).values(data).returning();
  return created;
}

export async function updateAutomationRule(
  id: string,
  data: Partial<InsertAutomationRule>,
): Promise<AutomationRule> {
  const [updated] = await db
    .update(automationRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(automationRules.id, id))
    .returning();
  if (!updated) throw new Error("Regra de automação não encontrada");
  return updated;
}

export async function toggleAutomationRuleActive(
  id: string,
  isActive: boolean,
): Promise<AutomationRule> {
  return updateAutomationRule(id, { isActive });
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await db.delete(automationRules).where(eq(automationRules.id, id));
}
