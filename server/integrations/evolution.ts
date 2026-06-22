function getConfig() {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Evolution API não configurada: defina EVOLUTION_API_URL e EVOLUTION_API_KEY no .env");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

function headers(apiKey: string) {
  return { "Content-Type": "application/json", ApiKey: apiKey };
}

/** Normaliza número BR para JID do WhatsApp: 5511999999999@s.whatsapp.net */
export function normalizeToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withDdi = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `${withDdi}@s.whatsapp.net`;
}

/** Extrai o número de telefone de um JID (remove @s.whatsapp.net, @g.us e :device_id) */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/** Retorna true se o JID é de grupo — conversas de grupo são ignoradas */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}

// ── Gestão de instâncias ───────────────────────────────────────────────────────

export interface EvolutionInstanceInfo {
  instanceName: string;
  instanceId: string;
  status: string;
}

export async function createInstance(
  instanceName: string,
  webhookUrl: string,
): Promise<EvolutionInstanceInfo> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      instanceName,
      token: instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      rejectCall: true,
      msgCall: "Não consigo atender chamadas aqui. Por favor, envie uma mensagem.",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
          "SEND_MESSAGE",
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`Evolution createInstance: ${await res.text()}`);
  const data = (await res.json()) as { instance: EvolutionInstanceInfo };
  return data.instance;
}

export async function connectInstance(instanceName: string): Promise<{ code: string; base64?: string }> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
    headers: { ApiKey: apiKey },
  });
  if (!res.ok) throw new Error(`Evolution connectInstance: ${await res.text()}`);
  return res.json() as Promise<{ code: string; base64?: string }>;
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
    headers: { ApiKey: apiKey },
  });
  if (!res.ok) throw new Error(`Evolution getInstanceStatus: ${await res.text()}`);
  const data = (await res.json()) as { instance: { state: string } };
  return { state: data.instance?.state ?? "unknown" };
}

export async function logoutInstance(instanceName: string): Promise<void> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
    headers: { ApiKey: apiKey },
  });
  if (!res.ok) throw new Error(`Evolution logoutInstance: ${await res.text()}`);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  const { baseUrl, apiKey } = getConfig();
  const res = await fetch(`${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE",
    headers: { ApiKey: apiKey },
  });
  if (!res.ok) throw new Error(`Evolution deleteInstance: ${await res.text()}`);
}

// ── Envio de mensagens ─────────────────────────────────────────────────────────

export interface EvolutionSendResult {
  key: { remoteJid: string; fromMe: boolean; id: string };
  status: string;
}

export async function sendText(
  instanceName: string,
  to: string,
  text: string,
  options: { delay?: number; quotedMsgId?: string } = {},
): Promise<EvolutionSendResult> {
  const { baseUrl, apiKey } = getConfig();
  const body: Record<string, unknown> = {
    number: normalizeToJid(to),
    text,
    delay: options.delay ?? 1200,
    linkPreview: false,
  };
  if (options.quotedMsgId) {
    body.quoted = { key: { id: options.quotedMsgId } };
  }
  const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Evolution sendText: ${await res.text()}`);
  return res.json() as Promise<EvolutionSendResult>;
}

export interface EvolutionMediaResult {
  key: { remoteJid: string; fromMe: boolean; id: string };
  status: string;
}

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video",
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string; delay?: number },
): Promise<EvolutionMediaResult> {
  const { baseUrl, apiKey } = getConfig();
  const body: Record<string, unknown> = {
    number: normalizeToJid(to),
    mediatype: mediaType,
    delay: opts.delay ?? 1200,
    ...(opts.caption ? { caption: opts.caption } : {}),
    ...(opts.filename ? { fileName: opts.filename } : {}),
    ...(opts.mimetype ? { mimetype: opts.mimetype } : {}),
    ...(opts.url ? { media: opts.url } : {}),
    ...(opts.base64 ? { media: opts.base64 } : {}),
  };
  const res = await fetch(`${baseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Evolution sendMedia: ${await res.text()}`);
  return res.json() as Promise<EvolutionMediaResult>;
}
