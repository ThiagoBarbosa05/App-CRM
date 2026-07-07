import { db } from "server/db";
import { clients, contactTags, tags, type Client } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export type MarketingTargetType = "all" | "category" | "origin" | "markers" | "custom";

/**
 * Retorna os IDs dos clientes que têm uma tag (por nome e tipo) via contact_tags.
 */
async function getClientIdsByTagName(
  tagName: string,
  tagType: "categoria" | "origem" | "marcador",
): Promise<Set<string>> {
  const matchingTags = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.type, tagType), eq(tags.name, tagName)));

  if (matchingTags.length === 0) return new Set();

  const tagIds = matchingTags.map((t) => t.id);

  const linkedClients = await db
    .select({ clientId: contactTags.clientId })
    .from(contactTags)
    .where(inArray(contactTags.tagId, tagIds));

  return new Set(linkedClients.map((r) => r.clientId));
}

/**
 * Resolve a lista de clientes-alvo de uma campanha de Email/SMS a partir do
 * mesmo targetType/targetCriteria usado hoje pelas campanhas de email.
 * Checa tanto o campo direto do cliente quanto a tabela contact_tags (sistema relacional de tags).
 */
export async function resolveTargetClients(
  targetType: MarketingTargetType,
  targetCriteria: string | null,
): Promise<Client[]> {
  const all = await db.select().from(clients);

  if (targetType === "all") return all;
  if (!targetCriteria) return [];

  if (targetType === "category") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "categoria");
    return all.filter(
      (c) => c.categoria === targetCriteria || taggedIds.has(c.id),
    );
  }

  if (targetType === "origin") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "origem");
    return all.filter(
      (c) => c.origem === targetCriteria || taggedIds.has(c.id),
    );
  }

  if (targetType === "markers") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "marcador");
    return all.filter(
      (c) => c.markers?.includes(targetCriteria) || taggedIds.has(c.id),
    );
  }

  if (targetType === "custom") {
    const ids = new Set(
      targetCriteria
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
    return all.filter((c) => ids.has(c.id));
  }

  return [];
}
