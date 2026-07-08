import { db } from "server/db";
import { clients, contactTags, tags, eventParticipants, type Client } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ClientsRepository } from "../repositories/clients.repository";

export type MarketingTargetType =
  | "all"
  | "category"
  | "origin"
  | "markers"
  | "custom"
  | "segment_filters";

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
 * targetType/targetCriteria.
 *
 * Suporta os tipos legados (all, category, origin, markers, custom) e o novo
 * tipo "segment_filters" onde targetCriteria é um JSON com { label, filters }
 * usando os mesmos filtros do repositório de clientes — garantindo paridade
 * total entre a contagem do card de segmentação e os destinatários da campanha.
 */
export async function resolveTargetClients(
  targetType: MarketingTargetType,
  targetCriteria: string | null,
): Promise<Client[]> {
  // "segment_filters" usa o repositório de clientes diretamente para garantir
  // que o número de destinatários seja idêntico ao do card de segmentação.
  if (targetType === "segment_filters") {
    if (!targetCriteria) {
      const all = await db.select().from(clients);
      return all;
    }
    try {
      const parsed = JSON.parse(targetCriteria) as { label?: string; filters?: Record<string, unknown> };
      const filters = parsed.filters ?? {};
      const repo = new ClientsRepository();
      const ids = await repo.getFilteredClientIds(undefined, "admin", filters as any);
      if (ids.length === 0) return [];
      const all = await db.select().from(clients).where(inArray(clients.id, ids));
      return all;
    } catch {
      const all = await db.select().from(clients);
      return all;
    }
  }

  const all = await db.select().from(clients);

  console.log(`[targeting] resolveTargetClients(${targetType}, ${targetCriteria}) — total clientes: ${all.length}`);

  if (targetType === "all") return all;
  if (!targetCriteria) return [];

  if (targetType === "category") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "categoria");
    const directMatch = all.filter((c) => c.categoria === targetCriteria);
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
    const seen = new Set<string>();
    return [...directMatch, ...tagMatch].filter((c) => (seen.has(c.id) ? false : seen.add(c.id) && true));
  }

  if (targetType === "origin") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "origem");
    const directMatch = all.filter((c) => c.origem === targetCriteria);
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
    const seen = new Set<string>();
    return [...directMatch, ...tagMatch].filter((c) => (seen.has(c.id) ? false : seen.add(c.id) && true));
  }

  if (targetType === "markers") {
    const taggedIds = await getClientIdsByTagName(targetCriteria, "marcador");
    const directMatch = all.filter((c) => c.markers?.includes(targetCriteria));
    const tagMatch = all.filter((c) => taggedIds.has(c.id));
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
