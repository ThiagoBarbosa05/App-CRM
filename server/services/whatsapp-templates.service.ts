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

/**
 * Resolve um template da Meta (nome + idioma) para uma linha local em
 * `whatsapp_templates`, criando-a se ainda não existir. Mantém o disparo de
 * campanhas funcionando (que referencia `waTemplateId`) sem expor o conceito
 * de "template local" para o usuário — ele só seleciona templates da Meta.
 */
export async function ensureLocalTemplateForMeta(params: {
  name: string;
  languageCode: string;
  category?: string;
  bodyParams?: string[];
  createdBy: string;
}): Promise<WhatsappTemplate> {
  const existing = await db
    .select()
    .from(whatsappTemplates)
    .where(eq(whatsappTemplates.name, params.name));

  const match = existing.find((t) => t.languageCode === params.languageCode) ?? existing[0];
  if (match) {
    // Reativa e sincroniza os parâmetros do corpo com o template atual da Meta
    const patch: Record<string, unknown> = {};
    if (!match.isActive) patch.isActive = true;
    if (params.bodyParams) patch.bodyParams = params.bodyParams;
    if (Object.keys(patch).length === 0) return match;
    const [updated] = await db
      .update(whatsappTemplates)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(whatsappTemplates.id, match.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(whatsappTemplates)
    .values({
      name: params.name,
      languageCode: params.languageCode,
      category: params.category,
      bodyParams: params.bodyParams ?? null,
      useCase: "campaign",
      isActive: true,
      createdBy: params.createdBy,
    })
    .returning();
  return created;
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
  quality_score?: { score?: string } | null;
  rejected_reason?: string | null;
}

const INACTIVE_META_STATUSES = new Set(["REJECTED", "PAUSED", "DISABLED", "PENDING_DELETION"]);

export async function updateTemplateMetaStatus(
  templateName: string,
  metaStatus: string,
  metaTemplateId?: number,
): Promise<void> {
  const patch: Record<string, unknown> = {
    metaStatus,
    updatedAt: new Date(),
  };
  if (metaTemplateId !== undefined) {
    patch.metaTemplateId = String(metaTemplateId);
  }
  if (INACTIVE_META_STATUSES.has(metaStatus)) {
    patch.isActive = false;
  }
  await db
    .update(whatsappTemplates)
    .set(patch)
    .where(eq(whatsappTemplates.name, templateName));
}

export async function updateTemplateQualityScore(
  templateName: string,
  qualityScore: string,
): Promise<void> {
  await db
    .update(whatsappTemplates)
    .set({ qualityScore, updatedAt: new Date() })
    .where(eq(whatsappTemplates.name, templateName));
}

export async function fetchMetaTemplates(): Promise<MetaTemplate[]> {
  const raw = await getWhatsappSettingsRaw();
  const accessToken = raw["wa_access_token"];
  const wabaId = raw["wa_waba_id"];
  const apiVersion = raw["wa_api_version"] || "v21.0";

  if (!accessToken || !wabaId) {
    throw new Error("wa_access_token e wa_waba_id são obrigatórios para buscar templates do Meta");
  }

  // Busca todos os status (aprovados, pendentes, rejeitados, pausados…)
  const fields = "id,name,status,category,language,components,quality_score,rejected_reason";
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=${fields}&limit=100`;
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

/** Exclui um template da Meta pelo nome (remove todos os idiomas com esse nome). */
export async function deleteMetaTemplate(name: string): Promise<void> {
  const raw = await getWhatsappSettingsRaw();
  const accessToken = raw["wa_access_token"];
  const wabaId = raw["wa_waba_id"];
  const apiVersion = raw["wa_api_version"] || "v21.0";

  if (!accessToken || !wabaId) {
    throw new Error("wa_access_token e wa_waba_id são obrigatórios para excluir templates do Meta");
  }

  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?name=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao excluir template do Meta: ${err}`);
  }
}
