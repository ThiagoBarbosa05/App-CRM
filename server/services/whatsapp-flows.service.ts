import { db } from "server/db";
import { eq } from "drizzle-orm";
import { whatsappFlows, type InsertWhatsappFlow } from "@shared/schema";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";

async function getMetaAuthHeaders() {
  const raw = await getWhatsappSettingsRaw();
  const accessToken = raw["wa_access_token"];
  const wabaId = raw["wa_waba_id"];
  const apiVersion = raw["wa_api_version"] || "v21.0";
  if (!accessToken || !wabaId) throw new Error("WhatsApp não configurado: wa_access_token e wa_waba_id são obrigatórios");
  return { accessToken, wabaId, apiVersion };
}

export async function listFlows() {
  return db.select().from(whatsappFlows).orderBy(whatsappFlows.name);
}

export async function syncFlowsFromMeta(userId: string): Promise<number> {
  const { accessToken, wabaId, apiVersion } = await getMetaAuthHeaders();

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/flows`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Meta API erro: ${res.status} ${await res.text()}`);

  const json = await res.json() as { data: Array<{ id: string; name: string; status: string; categories: string[] }> };
  const metaFlows = json.data ?? [];

  let synced = 0;
  for (const mf of metaFlows) {
    const existing = await db
      .select()
      .from(whatsappFlows)
      .where(eq(whatsappFlows.metaFlowId, mf.id))
      .limit(1);

    const status = (["DRAFT", "PUBLISHED", "DEPRECATED"].includes(mf.status) ? mf.status : "DRAFT") as "DRAFT" | "PUBLISHED" | "DEPRECATED";

    if (existing.length > 0) {
      await db
        .update(whatsappFlows)
        .set({ name: mf.name, status, categories: mf.categories ?? [], updatedAt: new Date() })
        .where(eq(whatsappFlows.metaFlowId, mf.id));
    } else {
      const payload: InsertWhatsappFlow = {
        metaFlowId: mf.id,
        name: mf.name,
        status,
        categories: mf.categories ?? [],
        createdBy: userId,
      };
      await db.insert(whatsappFlows).values(payload);
    }
    synced++;
  }

  return synced;
}
