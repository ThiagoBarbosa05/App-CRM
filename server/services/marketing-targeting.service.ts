import { db } from "server/db";
import { clients, type Client } from "@shared/schema";

export type MarketingTargetType = "all" | "category" | "origin" | "markers" | "custom";

/**
 * Resolve a lista de clientes-alvo de uma campanha de Email/SMS a partir do
 * mesmo targetType/targetCriteria usado hoje pelas campanhas de email
 * (server/storage.ts::sendEmailCampaign). Mantido em um único lugar para que
 * Email e SMS apliquem exatamente o mesmo critério de segmentação.
 */
export async function resolveTargetClients(
  targetType: MarketingTargetType,
  targetCriteria: string | null,
): Promise<Client[]> {
  const all = await db.select().from(clients);

  if (targetType === "all") return all;
  if (!targetCriteria) return [];

  if (targetType === "category") {
    return all.filter((c) => c.categoria === targetCriteria);
  }
  if (targetType === "origin") {
    return all.filter((c) => c.origem === targetCriteria);
  }
  if (targetType === "markers") {
    return all.filter((c) => c.markers?.includes(targetCriteria));
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
