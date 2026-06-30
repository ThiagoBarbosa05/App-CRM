import { db } from "server/db";
import {
  whatsappTemplates,
  whatsappTemplateMedia,
  type InsertWhatsappTemplate,
  type WhatsappTemplate,
} from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { getPublicR2Url } from "../lib/r2";

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
  parameter_format?: "NAMED" | "POSITIONAL";
  components: unknown[];
  quality_score?: { score?: string } | null;
  rejected_reason?: string | null;
  // Mídia padrão de cabeçalho configurada localmente (não vem da Meta).
  headerMedia?: { mediaType: "image" | "video" | "document"; storageKey: string; url: string } | null;
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
  const fields =
    "id,name,status,category,language,parameter_format,components,quality_score,rejected_reason";
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=${fields}&limit=100`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao buscar templates do Meta: ${err}`);
  }

  const json = await response.json();
  const templates = (json.data ?? []) as MetaTemplate[];

  // Anexa a mídia padrão de cabeçalho configurada localmente (por nome + idioma).
  const mediaRows = await db.select().from(whatsappTemplateMedia);
  const mediaByKey = new Map(
    mediaRows.map((m) => [`${m.templateName}::${m.languageCode}`, m]),
  );
  for (const t of templates) {
    const media = mediaByKey.get(`${t.name}::${t.language}`);
    t.headerMedia = media
      ? {
          mediaType: media.mediaType as "image" | "video" | "document",
          storageKey: media.storageKey,
          url: getPublicR2Url(media.storageKey),
        }
      : null;
  }

  return templates;
}

/** Busca a mídia padrão de cabeçalho de um template (nome + idioma). */
export async function getTemplateMedia(
  templateName: string,
  languageCode: string,
): Promise<{ mediaType: "image" | "video" | "document"; storageKey: string } | null> {
  const [row] = await db
    .select()
    .from(whatsappTemplateMedia)
    .where(
      and(
        eq(whatsappTemplateMedia.templateName, templateName),
        eq(whatsappTemplateMedia.languageCode, languageCode),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    mediaType: row.mediaType as "image" | "video" | "document",
    storageKey: row.storageKey,
  };
}

/** Cria ou atualiza a mídia padrão de cabeçalho de um template (por nome + idioma). */
export async function upsertTemplateMedia(params: {
  templateName: string;
  languageCode: string;
  mediaType: "image" | "video" | "document";
  storageKey: string;
  userId?: string;
}): Promise<void> {
  await db
    .insert(whatsappTemplateMedia)
    .values({
      templateName: params.templateName,
      languageCode: params.languageCode,
      mediaType: params.mediaType,
      storageKey: params.storageKey,
      createdBy: params.userId,
    })
    .onConflictDoUpdate({
      target: [whatsappTemplateMedia.templateName, whatsappTemplateMedia.languageCode],
      set: {
        mediaType: params.mediaType,
        storageKey: params.storageKey,
        updatedAt: new Date(),
      },
    });
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
