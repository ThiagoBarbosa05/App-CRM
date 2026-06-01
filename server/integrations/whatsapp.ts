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
  return phone.replace(/\D/g, "");
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
  formData.append("file", new Blob([file], { type: contentType }), filename);
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
