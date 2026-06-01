import { db } from "server/db";
import { whatsappTemplates, type InsertWhatsappTemplate, type WhatsappTemplate } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";

export async function listLocalTemplates(): Promise<WhatsappTemplate[]> {
  return db.select().from(whatsappTemplates).orderBy(whatsappTemplates.createdAt);
}

export async function getTemplateByUseCase(useCase: string): Promise<WhatsappTemplate | null> {
  const all = await db.select().from(whatsappTemplates);
  return all.find((t) => t.useCase === useCase && t.isActive) ?? null;
}

export async function createLocalTemplate(data: InsertWhatsappTemplate): Promise<WhatsappTemplate> {
  const [created] = await db.insert(whatsappTemplates).values(data).returning();
  return created;
}

export async function updateLocalTemplate(
  id: string,
  data: Partial<InsertWhatsappTemplate>,
): Promise<WhatsappTemplate> {
  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(whatsappTemplates.id, id))
    .returning();
  if (!updated) throw new Error("Template not found");
  return updated;
}

export async function deleteLocalTemplate(id: string): Promise<void> {
  await db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, id));
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: unknown[];
}

export async function fetchMetaTemplates(): Promise<MetaTemplate[]> {
  const raw = await getWhatsappSettingsRaw();
  const accessToken = raw["wa_access_token"];
  const wabaId = raw["wa_waba_id"];
  const apiVersion = raw["wa_api_version"] || "v21.0";

  if (!accessToken || !wabaId) {
    throw new Error("wa_access_token e wa_waba_id são obrigatórios para buscar templates do Meta");
  }

  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?status=APPROVED&limit=100`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao buscar templates do Meta: ${err}`);
  }

  const json = await response.json();
  return (json.data ?? []) as MetaTemplate[];
}
