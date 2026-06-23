// Camada de integração "Evolution" — agora 100% in-process via Baileys.
// A superfície pública (nomes/assinaturas) é mantida para não impactar os
// chamadores (whatsapp-channels.routes.ts, whatsapp-conversations.service.ts,
// evolution-webhook.routes.ts). Internamente delega ao session-manager que roda
// o Baileys dentro do próprio processo do CRM.

import {
  startInstance,
  forceRestartInstance,
  waitForQr,
  getConnectionState,
  logoutInstance as smLogoutInstance,
  destroyInstance as smDestroyInstance,
  sendText as smSendText,
  sendMedia as smSendMedia,
} from "../services/baileys/session-manager";

// Re-exporta os helpers puros de JID (mantém os imports existentes funcionando)
export { normalizeToJid, jidToPhone, isGroupJid } from "../services/baileys/jid";

// ── Gestão de instâncias ───────────────────────────────────────────────────────

export interface EvolutionInstanceInfo {
  instanceName: string;
  instanceId: string;
  status: string;
}

export async function createInstance(
  instanceName: string,
  _webhookUrl?: string,
): Promise<EvolutionInstanceInfo> {
  // _webhookUrl não é mais necessário (eventos são entregues in-process)
  const { instanceId, status } = startInstance(instanceName);
  return { instanceName, instanceId, status };
}

export async function connectInstance(instanceName: string): Promise<{ code: string; base64?: string }> {
  // Reinicia a instância com credenciais limpas para evitar conflito 401
  // device_removed causado por chaves Signal obsoletas no banco.
  // Se já estiver conectado, forceRestartInstance retorna sem interromper.
  await forceRestartInstance(instanceName);
  const qr = await waitForQr(instanceName, 30_000);
  if (!qr) return { code: "", base64: undefined };
  return { code: qr.code, base64: qr.base64 ?? undefined };
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  return { state: getConnectionState(instanceName) };
}

export async function logoutInstance(instanceName: string): Promise<void> {
  await smLogoutInstance(instanceName);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await smDestroyInstance(instanceName);
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
  return smSendText(instanceName, to, text, options);
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
  return smSendMedia(instanceName, to, mediaType, opts);
}
