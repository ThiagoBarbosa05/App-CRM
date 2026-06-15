import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";

interface WaConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  baseUrl: string;
}

async function getConfig(): Promise<WaConfig> {
  const raw = await getWhatsappSettingsRaw();
  const phoneNumberId = raw["wa_phone_number_id"];
  const accessToken = raw["wa_access_token"];
  const apiVersion = raw["wa_api_version"] || "v21.0";

  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp não configurado: wa_phone_number_id e wa_access_token são obrigatórios");
  }

  return {
    phoneNumberId,
    accessToken,
    apiVersion,
    baseUrl: `https://graph.facebook.com/${apiVersion}`,
  };
}

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Números brasileiros sem DDI: 10 dígitos (fixo) ou 11 dígitos (celular)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export async function sendTextMessage(to: string, text: string) {
  const cfg = await getConfig();
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { body: text },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "pt_BR",
  components?: object[],
) {
  const cfg = await getConfig();
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components?.length ? { components } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function uploadMedia(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const cfg = await getConfig();
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(file)], { type: contentType }), filename);
  formData.append("messaging_product", "whatsapp");
  formData.append("type", contentType);

  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.id as string;
}

export async function sendMediaMessage(
  to: string,
  mediaId: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption?: string,
) {
  const cfg = await getConfig();
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: mediaType,
      [mediaType]: { id: mediaId, ...(caption ? { caption } : {}) },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function fetchMediaStream(mediaId: string): Promise<{ stream: ReadableStream; contentType: string; contentLength?: string }> {
  const cfg = await getConfig();

  // Step 1: resolve the temporary download URL
  // phone_number_id is required by Meta API for media retrieval
  const metaRes = await fetch(`${cfg.baseUrl}/${mediaId}?phone_number_id=${cfg.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!metaRes.ok) {
    const errBody = await metaRes.text().catch(() => "(sem body)");
    throw new Error(`Meta API erro ao buscar mídia ${mediaId}: ${metaRes.status} — ${errBody}`);
  }
  const meta = await metaRes.json() as { url: string; mime_type: string; file_size?: number };

  // Step 2: download the actual file
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!fileRes.ok || !fileRes.body) {
    throw new Error(`Erro ao baixar mídia ${mediaId}: ${fileRes.status}`);
  }

  return {
    stream: fileRes.body,
    contentType: meta.mime_type,
    contentLength: meta.file_size != null ? String(meta.file_size) : fileRes.headers.get("content-length") ?? undefined,
  };
}

// Baixa a mídia da Meta inteira para um Buffer (para persistir no R2 enquanto o ID ainda é válido).
export async function downloadMediaToBuffer(mediaId: string): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const cfg = await getConfig();

  const metaRes = await fetch(`${cfg.baseUrl}/${mediaId}?phone_number_id=${cfg.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!metaRes.ok) {
    const errBody = await metaRes.text().catch(() => "(sem body)");
    throw new Error(`Meta API erro ao buscar mídia ${mediaId}: ${metaRes.status} — ${errBody}`);
  }
  const meta = await metaRes.json() as { url: string; mime_type: string; file_size?: number };

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Erro ao baixar mídia ${mediaId}: ${fileRes.status}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, contentType: meta.mime_type, size: buffer.length };
}

export interface MetaTemplateCreatePayload {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  parameter_format?: "NAMED" | "POSITIONAL";
  components: Record<string, unknown>[];
}

export async function createMetaTemplate(payload: MetaTemplateCreatePayload): Promise<{ id: string; status: string }> {
  const cfg = await getConfig();
  const raw = await getWhatsappSettingsRaw();
  const wabaId = raw["wa_waba_id"];
  if (!wabaId) throw new Error("WhatsApp não configurado: wa_waba_id é obrigatório");

  const res = await fetch(`${cfg.baseUrl}/${wabaId}/message_templates`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getApprovedTemplates() {
  const cfg = await getConfig();
  const raw = await getWhatsappSettingsRaw();
  const wabaId = raw["wa_waba_id"];
  if (!wabaId) throw new Error("WhatsApp não configurado: wa_waba_id é obrigatório");

  const response = await fetch(
    `${cfg.baseUrl}/${wabaId}/message_templates?status=APPROVED&limit=100`,
    { headers: authHeaders(cfg.accessToken) },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
