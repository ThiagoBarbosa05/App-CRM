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

  console.log(`[targeting] getClientIdsByTagName(${tagName}, ${tagType}) → ${matchingTags.length} tag(s) encontrada(s):`, matchingTags);

  if (matchingTags.length === 0) return new Set();

  const tagIds = matchingTags.map((t) => t.id);

  const linkedClients = await db
    .select({ clientId: contactTags.clientId })
    .from(contactTags)
    .where(inArray(contactTags.tagId, tagIds));

  console.log(`[targeting] contact_tags para tagIds [${tagIds.join(",")}] → ${linkedClients.length} cliente(s)`);

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

  console.log(`[targeting] resolveTargetClients(${targetType}, ${targetCriteria}) — total clientes: ${all.length}`);

  if (targetType === "all") return all;
  if (!targetCriteria) return [];

  if (targetType === "category") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "categoria");
    const directMatch = all.filter((c) => c.categoria === targetCriteria);
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
    console.log(`[targeting] category="${targetCriteria}" → direto: ${directMatch.length}, via tag: ${tagMatch.length}`);
    const seen = new Set<string>();
    return [...directMatch, ...tagMatch].filter((c) => (seen.has(c.id) ? false : seen.add(c.id) && true));
  }

  if (targetType === "origin") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "origem");
    const directMatch = all.filter((c) => c.origem === targetCriteria);
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
    console.log(`[targeting] origin="${targetCriteria}" → direto: ${directMatch.length}, via tag: ${tagMatch.length}`);
    const seen = new Set<string>();
    return [...directMatch, ...tagMatch].filter((c) => (seen.has(c.id) ? false : seen.add(c.id) && true));
  }

  if (targetType === "markers") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "marcador");
    const directMatch = all.filter((c) => c.markers?.includes(targetCriteria));
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
    console.log(`[targeting] markers="${targetCriteria}" → direto: ${directMatch.length}, via tag: ${tagMatch.length}`);
    const seen = new Set<string>();
    return [...directMatch, ...tagMatch].filter((c) => (seen.has(c.id) ? false : seen.add(c.id) && true));
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
