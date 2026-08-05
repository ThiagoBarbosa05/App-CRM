import { and, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import { clients } from "@shared/schema";
import { db } from "../db";
import { normalizePhoneE164 } from "@shared/phone";
import { CAMPAIGN_SUPPRESSION_REASONS } from "@shared/whatsapp-campaign-reasons";

export type CampaignAudienceSelector =
  | { mode: "explicit"; clientIds: string[] }
  | {
      mode: "filter";
      search?: string;
      whatsappTagIds: string[];
      exclusiveWhatsappTags: boolean;
      excludedClientIds: string[];
    };

export async function resolveCampaignAudience(selector: CampaignAudienceSelector, onlyClientId?: string) {
  if (selector.mode === "explicit") {
    const ids = onlyClientId ? selector.clientIds.filter((id) => id === onlyClientId) : selector.clientIds;
    if (ids.length === 0) return [];
    return db.select().from(clients).where(inArray(clients.id, ids));
  }

  const conditions = [];
  if (onlyClientId) conditions.push(sql`${clients.id} = ${onlyClientId}`);
  const search = selector.search?.trim();
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(ilike(clients.name, term), ilike(clients.phone, term))!);
  }
  if (selector.excludedClientIds.length > 0) {
    conditions.push(notInArray(clients.id, selector.excludedClientIds));
  }
  if (selector.whatsappTagIds.length > 0) {
    const ids = selector.whatsappTagIds;
    conditions.push(sql`(
      SELECT COUNT(DISTINCT ct.whatsapp_tag_id)
      FROM contact_tags ct
      WHERE ct.client_id = ${clients.id}
        AND ct.whatsapp_tag_id = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::text[])
    ) ${selector.exclusiveWhatsappTags ? sql`= ${ids.length}` : sql`> 0`}`);
    if (selector.exclusiveWhatsappTags) {
      conditions.push(sql`(
        SELECT COUNT(DISTINCT ct.whatsapp_tag_id)
        FROM contact_tags ct
        WHERE ct.client_id = ${clients.id} AND ct.whatsapp_tag_id IS NOT NULL
      ) = ${ids.length}`);
    }
  }
  return db.select().from(clients).where(conditions.length ? and(...conditions) : undefined);
}

export async function stillMatchesCampaignAudience(
  clientId: string,
  selector: CampaignAudienceSelector | null,
): Promise<boolean> {
  if (!selector || selector.mode === "explicit") return true;
  const rows = await resolveCampaignAudience(selector, clientId);
  return rows.length > 0;
}

export async function validateCampaignRecipient(
  clientId: string,
  expectedPhone: string,
  selector: CampaignAudienceSelector | null,
): Promise<string | null> {
  const [client] = await db.select().from(clients).where(sql`${clients.id} = ${clientId}`).limit(1);
  if (!client) return "Contato não encontrado";
  if (client.whatsappOptOut) return CAMPAIGN_SUPPRESSION_REASONS.optedOut;
  const currentPhone = normalizePhoneE164(client.phone);
  if (!currentPhone || currentPhone !== expectedPhone) return CAMPAIGN_SUPPRESSION_REASONS.invalidOrChangedPhone;
  if (!await stillMatchesCampaignAudience(clientId, selector)) {
    return CAMPAIGN_SUPPRESSION_REASONS.tagsChanged;
  }
  return null;
}
