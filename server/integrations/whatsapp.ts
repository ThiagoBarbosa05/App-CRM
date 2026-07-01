import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";
import { toMetaWhatsAppId } from "@shared/phone";

// Erro tipado com o status HTTP da resposta da Meta, para que quem chama
// sendTextMessage/sendTemplateMessage consiga distinguir rate-limit (429) de
// outras falhas (template inválido, número inválido etc.) e decidir se vale
// a pena reagendar com backoff em vez de marcar a mensagem como falha definitiva.
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

interface WaConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  baseUrl: string;
}

export interface ChannelOverride {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

async function getConfig(channel?: ChannelOverride): Promise<WaConfig> {
  if (channel) {
    const apiVersion = channel.apiVersion ?? "v21.0";
    return {
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
      apiVersion,
      baseUrl: `https://graph.facebook.com/${apiVersion}`,
    };
  }

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

export async function sendTextMessage(to: string, text: string, channel?: ChannelOverride, contextMessageId?: string) {
  const cfg = await getConfig(channel);
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}),
      type: "text",
      text: { body: text },
    }),
  });
  if (!response.ok) throw new WhatsAppApiError(await response.text(), response.status);
  return response.json();
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "pt_BR",
  components?: object[],
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toMetaWhatsAppId(to),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components?.length ? { components } : {}),
    },
  };

  console.log(
    `[WA] sendTemplateMessage → phoneNumberId=${cfg.phoneNumberId} to=${toMetaWhatsAppId(to)} template=${templateName} lang=${languageCode}`,
  );
  console.log(`[WA] payload:`, JSON.stringify(payload, null, 2));

  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log(`[WA] response status=${response.status} body:`, responseText);

  if (!response.ok) throw new WhatsAppApiError(responseText, response.status);
  return JSON.parse(responseText);
}

export async function uploadMedia(
  file: Buffer,
  filename: string,
  contentType: string,
  channel?: ChannelOverride,
): Promise<string> {
  const cfg = await getConfig(channel);
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
  mediaType: "image" | "document" | "video" | "audio" | "sticker",
  caption?: string,
  filename?: string,
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const mediaKey = mediaType === "sticker" ? "sticker" : mediaType;
  const mediaBody = mediaType === "sticker"
    ? { id: mediaId }
    : {
        id: mediaId,
        ...(caption ? { caption } : {}),
        ...(mediaType === "document" && filename ? { filename } : {}),
      };
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: mediaType,
      [mediaKey]: mediaBody,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function sendMediaByUrl(
  to: string,
  mediaUrl: string,
  mediaType: "image" | "document",
  caption?: string,
  filename?: string,
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const mediaBody: Record<string, string> = { link: mediaUrl };
  if (caption) mediaBody.caption = caption;
  if (mediaType === "document" && filename) mediaBody.filename = filename;
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: mediaType,
      [mediaType]: mediaBody,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function sendReaction(
  to: string,
  waMessageId: string,
  emoji: string,
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: "reaction",
      reaction: { message_id: waMessageId, emoji },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function fetchMediaStream(mediaId: string, channel?: ChannelOverride): Promise<{ stream: ReadableStream; contentType: string; contentLength?: string }> {
  const cfg = await getConfig(channel);

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

export async function sendFlowMessage(
  to: string,
  flowId: string,
  ctaText: string,
  options: { bodyText?: string; flowToken?: string } = {},
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: "interactive",
      interactive: {
        type: "flow",
        ...(options.bodyText ? { body: { text: options.bodyText } } : {}),
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: flowId,
            flow_cta: ctaText,
            flow_action: "navigate",
            ...(options.flowToken ? { flow_token: options.flowToken } : {}),
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

/**
 * Envia uma mensagem interativa com até 3 botões de resposta rápida.
 * O `id` de cada botão volta no webhook como `interactive.button_reply.id`,
 * permitindo rotear o fluxo do bot pela opção escolhida.
 * Limites Meta: máx. 3 botões; título ≤ 20 caracteres.
 */
export async function sendButtonsMessage(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  options: { headerText?: string; footerText?: string } = {},
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: "interactive",
      interactive: {
        type: "button",
        ...(options.headerText ? { header: { type: "text", text: options.headerText } } : {}),
        body: { text: bodyText },
        ...(options.footerText ? { footer: { text: options.footerText } } : {}),
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

/**
 * Envia uma mensagem interativa de lista (menu) com até 10 linhas em uma seção.
 * O `id` de cada linha volta no webhook como `interactive.list_reply.id`.
 * Limites Meta: máx. 10 linhas; título da linha ≤ 24 caracteres; texto do botão ≤ 20.
 */
export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  options: { headerText?: string; footerText?: string } = {},
  channel?: ChannelOverride,
) {
  const cfg = await getConfig(channel);
  const response = await fetch(`${cfg.baseUrl}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toMetaWhatsAppId(to),
      type: "interactive",
      interactive: {
        type: "list",
        ...(options.headerText ? { header: { type: "text", text: options.headerText } } : {}),
        body: { text: bodyText },
        ...(options.footerText ? { footer: { text: options.footerText } } : {}),
        action: {
          button: (buttonText || "Escolher").slice(0, 20),
          sections: [
            {
              rows: rows.slice(0, 10).map((r) => ({
                id: r.id,
                title: r.title.slice(0, 24),
                ...(r.description ? { description: r.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function downloadMediaToBuffer(mediaId: string, channel?: ChannelOverride): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const cfg = await getConfig(channel);

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

/**
 * Faz upload de uma mídia via Resumable Upload API da Meta e retorna o `handle`
 * usado como exemplo em cabeçalhos de template (IMAGE/VIDEO/DOCUMENT).
 * Requer `wa_app_id` configurado (o handle é vinculado ao App, não à WABA).
 */
export async function uploadTemplateMediaHandle(
  file: Buffer,
  mimeType: string,
): Promise<string> {
  const cfg = await getConfig();
  const raw = await getWhatsappSettingsRaw();
  const appId = raw["wa_app_id"];
  if (!appId) {
    throw new Error(
      "WhatsApp não configurado: wa_app_id é obrigatório para upload de mídia de template",
    );
  }

  // 1. Abrir sessão de upload
  const sessionUrl = `${cfg.baseUrl}/${appId}/uploads?file_length=${file.length}&file_type=${encodeURIComponent(mimeType)}`;
  const sessionRes = await fetch(sessionUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
  if (!sessionRes.ok) throw new Error(await sessionRes.text());
  const session = (await sessionRes.json()) as { id?: string };
  if (!session.id) throw new Error("Falha ao iniciar sessão de upload na Meta");

  // 2. Enviar o binário (file_offset: 0)
  const uploadRes = await fetch(`${cfg.baseUrl}/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${cfg.accessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: file,
  });
  if (!uploadRes.ok) throw new Error(await uploadRes.text());
  const result = (await uploadRes.json()) as { h?: string };
  if (!result.h) throw new Error("Upload concluído mas a Meta não retornou o handle");
  return result.h;
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

// ── Gerenciamento de números ───────────────────────────────────────────────────

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status: "VERIFIED" | "PENDING" | "EXPIRED" | "NOT_VERIFIED";
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  status: "CONNECTED" | "DISCONNECTED" | "PENDING" | "FLAGGED" | "RESTRICTED";
  platform_type?: string;
}

const PHONE_FIELDS = "id,display_phone_number,verified_name,code_verification_status,quality_rating,status,platform_type";

export async function listWabaPhoneNumbers(): Promise<MetaPhoneNumber[]> {
  const cfg = await getConfig();
  const raw = await getWhatsappSettingsRaw();
  const wabaId = raw["wa_waba_id"];
  if (!wabaId) throw new Error("WhatsApp não configurado: wa_waba_id é obrigatório");

  const res = await fetch(
    `${cfg.baseUrl}/${wabaId}/phone_numbers?fields=${PHONE_FIELDS}&limit=100`,
    { headers: authHeaders(cfg.accessToken) },
  );
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json() as { data: MetaPhoneNumber[] };
  return json.data ?? [];
}

export async function getPhoneNumberDetails(phoneNumberId: string, channel?: ChannelOverride): Promise<MetaPhoneNumber> {
  const cfg = await getConfig(channel);
  const res = await fetch(
    `${cfg.baseUrl}/${phoneNumberId}?fields=${PHONE_FIELDS}`,
    { headers: authHeaders(cfg.accessToken) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<MetaPhoneNumber>;
}

export async function requestVerificationCode(
  phoneNumberId: string,
  codeMethod: "SMS" | "VOICE",
  channel?: ChannelOverride,
): Promise<void> {
  const cfg = await getConfig(channel);
  const res = await fetch(`${cfg.baseUrl}/${phoneNumberId}/request_code`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({ code_method: codeMethod, language: "pt_BR" }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function verifyPhoneNumber(
  phoneNumberId: string,
  code: string,
  channel?: ChannelOverride,
): Promise<void> {
  const cfg = await getConfig(channel);
  const res = await fetch(`${cfg.baseUrl}/${phoneNumberId}/verify_code`, {
    method: "POST",
    headers: authHeaders(cfg.accessToken),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await res.text());
}
