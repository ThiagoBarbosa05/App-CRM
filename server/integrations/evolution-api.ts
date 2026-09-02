import { randomUUID } from "node:crypto";

const TIMEOUT_MS = 40_000;
export type EvolutionApiErrorCode = "not_configured" | "unauthorized" | "not_found" | "rate_limited" | "unavailable" | "unexpected";

export class EvolutionApiError extends Error {
  constructor(message: string, public readonly code: EvolutionApiErrorCode, public readonly status?: number) {
    super(message);
    this.name = "EvolutionApiError";
  }
}

function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!baseUrl || !apiKey) throw new EvolutionApiError("Evolution API não configurada", "not_configured");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new EvolutionApiError("EVOLUTION_API_URL deve ser uma URL absoluta da Evolution API", "not_configured");
  }
  if (/\/api\/evolution(?:\/v2)?\/webhook\/?$/i.test(parsedUrl.pathname)) {
    throw new EvolutionApiError(
      "EVOLUTION_API_URL aponta para o webhook do CRM. Informe apenas a URL base da Evolution API (ex.: http://evolution:8080) e mantenha o webhook em EVOLUTION_WEBHOOK_URL.",
      "not_configured",
    );
  }
  return { baseUrl, apiKey };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = config();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: apiKey, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch (error) {
    throw new EvolutionApiError(error instanceof Error ? error.message : "Falha de rede", "unavailable");
  }
  if (response.ok) return response.status === 204 ? undefined as T : await response.json() as T;
  const body = await response.json().catch(() => null) as { message?: string; response?: { message?: string } } | null;
  const code: EvolutionApiErrorCode = response.status === 401 || response.status === 403 ? "unauthorized" : response.status === 404 ? "not_found" : response.status === 429 ? "rate_limited" : response.status >= 500 ? "unavailable" : "unexpected";
  const message = code === "unauthorized"
    ? "Evolution API recusou a apikey. EVOLUTION_API_KEY no CRM deve ser exatamente igual a AUTHENTICATION_API_KEY na VM Evolution; reinicie os dois serviços após alterar a chave."
    : body?.message ?? body?.response?.message ?? `Evolution API retornou ${response.status}`;
  throw new EvolutionApiError(message, code, response.status);
}

export interface EvolutionSendResult { key: { remoteJid: string; fromMe: boolean; id: string }; status: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeEvolutionQrData(data: unknown): {
  code: string | null;
  base64: string | null;
} {
  const root = asRecord(data);
  const nested = asRecord(root?.qrcode);
  const code = asNonEmptyString(nested?.code)
    ?? asNonEmptyString(root?.code)
    ?? asNonEmptyString(nested?.pairingCode)
    ?? asNonEmptyString(root?.pairingCode);
  const rawBase64 = asNonEmptyString(nested?.base64) ?? asNonEmptyString(root?.base64);
  const base64 = rawBase64
    ? rawBase64.startsWith("data:")
      ? rawBase64
      : `data:image/png;base64,${rawBase64}`
    : null;
  return { code, base64 };
}

export interface EvolutionWebhookConfig {
  url: string;
  byEvents: boolean;
  base64: boolean;
  events: string[];
  headers?: Record<string, string>;
}

export function buildEvolutionWebhookConfig(webhookUrl: string): EvolutionWebhookConfig {
  const webhookToken = process.env.EVOLUTION_WEBHOOK_TOKEN?.trim();
  return {
    url: webhookUrl,
    byEvents: false,
    base64: true,
    events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_SET", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE"],
    ...(webhookToken ? { headers: { "x-evolution-webhook-token": webhookToken } } : {}),
  };
}

export const evolutionApi = {
  createInstance(instanceName: string, webhookUrl?: string) {
    return request<{ instance: { instanceName: string; status: string } }>("/instance/create", { method: "POST", body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true, ...(webhookUrl ? { webhook: buildEvolutionWebhookConfig(webhookUrl) } : {}) }) });
  },
  findWebhook(instanceName: string) { return request<EvolutionWebhookConfig>(`/webhook/find/${encodeURIComponent(instanceName)}`); },
  setWebhook(instanceName: string, config: EvolutionWebhookConfig) { return request<unknown>(`/webhook/set/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify(config) }); },
  getInstance(instanceName: string) { return request<{ instance: { instanceName: string; status: string } }>(`/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`); },
  getConnectionState(instanceName: string) { return request<{ instance: { state: string } }>(`/instance/connectionState/${encodeURIComponent(instanceName)}`); },
  connect(instanceName: string) { return request<{ code?: string; base64?: string; pairingCode?: string; count?: number }>(`/instance/connect/${encodeURIComponent(instanceName)}`); },
  logout(instanceName: string) { return request<unknown>(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" }); },
  deleteInstance(instanceName: string) { return request<void>(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" }); },
  sendText(instanceName: string, body: { to: string; text: string; quotedMsgId?: string }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendText/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, text: body.text, ...(body.quotedMsgId ? { quoted: { key: { id: body.quotedMsgId } } } : {}) }) }); },
  sendMedia(instanceName: string, body: { to: string; type: string; url?: string; base64?: string; caption?: string; filename?: string; mimetype?: string; quotedMsgId?: string; ptt?: boolean }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendMedia/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, mediatype: body.type, media: body.url ?? body.base64, caption: body.caption, fileName: body.filename, mimetype: body.mimetype, ptt: body.ptt, ...(body.quotedMsgId ? { quoted: { key: { id: body.quotedMsgId } } } : {}) }) }); },
  sendAudio(instanceName: string, body: { to: string; audio: string; quotedMsgId?: string }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, audio: body.audio, ...(body.quotedMsgId ? { quoted: { key: { id: body.quotedMsgId } } } : {}) }) }); },
  sendReaction(instanceName: string, body: { remoteJid: string; fromMe: boolean; id: string; reaction: string }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendReaction/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ key: { remoteJid: body.remoteJid, fromMe: body.fromMe, id: body.id }, reaction: body.reaction }) }); },
  sendLocation(instanceName: string, body: { to: string; latitude: number; longitude: number; name?: string; address?: string }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendLocation/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, latitude: body.latitude, longitude: body.longitude, name: body.name, address: body.address }) }); },
  sendContacts(instanceName: string, body: { to: string; contacts: Array<{ displayName: string; vcard: string }> }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendContact/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, contact: body.contacts.map((contact) => ({ fullName: contact.displayName, phoneNumber: /TEL[^:]*:([^\\n]+)/i.exec(contact.vcard)?.[1] ?? "", organization: "", email: "", url: "" })) }) }); },
  sendPoll(instanceName: string, body: { to: string; name: string; values: string[]; selectableCount?: number }, idempotencyKey: string = randomUUID()) { return request<EvolutionSendResult>(`/message/sendPoll/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, name: body.name, values: body.values, selectableCount: body.selectableCount ?? 1 }) }); },
  readMessages(instanceName: string, messages: Array<{ remoteJid: string; fromMe: boolean; id: string; participant?: string }>, idempotencyKey: string = randomUUID()) { return request<void>(`/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ readMessages: messages.map((message) => ({ remoteJid: message.remoteJid, fromMe: message.fromMe, id: message.id, participant: message.participant })) }) }); },
  sendPresence(instanceName: string, body: { to: string; presence: string }, idempotencyKey: string = randomUUID()) { return request<void>(`/chat/sendPresence/${encodeURIComponent(instanceName)}`, { method: "POST", headers: { "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ number: body.to, presence: body.presence }) }); },
  getMediaBase64(instanceName: string, message: Record<string, unknown>) { return request<{ base64?: string; mimetype?: string; fileName?: string }>(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ message, convertToMp4: false }) }); },
  fetchProfilePicture(instanceName: string, number: string) { return request<{ profilePictureUrl?: string | null }>(`/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ number }) }); },
};
