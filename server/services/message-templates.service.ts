import { db } from "server/db";
import {
  messageTemplates,
  type InsertMessageTemplate,
  type MessageTemplate,
} from "@shared/schema";
import { asc, desc, eq } from "drizzle-orm";

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return db
    .select()
    .from(messageTemplates)
    .orderBy(asc(messageTemplates.sortOrder), desc(messageTemplates.createdAt));
}

export async function reorderMessageTemplates(
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(messageTemplates)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(messageTemplates.id, id)),
    ),
  );
}

export async function getMessageTemplateById(
  id: string,
): Promise<MessageTemplate | null> {
  const [row] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, id));
  return row ?? null;
}

export async function createMessageTemplate(
  data: InsertMessageTemplate,
): Promise<MessageTemplate> {
  const [created] = await db.insert(messageTemplates).values(data).returning();
  return created;
}

export async function updateMessageTemplate(
  id: string,
  data: Partial<InsertMessageTemplate>,
): Promise<MessageTemplate> {
  const [updated] = await db
    .update(messageTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(messageTemplates.id, id))
    .returning();
  if (!updated) throw new Error("Template não encontrado");
  return updated;
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
}

/** Substitui variáveis no formato {{nome}} pelos valores fornecidos. */
export function renderTemplate(
  content: string,
  variables: Record<string, string | number>,
): string {
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? match : String(value);
  });
}
