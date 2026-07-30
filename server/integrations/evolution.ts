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
  getProfilePictureUrl as smGetProfilePictureUrl,
} from "../services/baileys/session-manager";
import { randomUUID } from "node:crypto";
import { getChannelByEvolutionInstance } from "../services/whatsapp-channels.service";
import { baileysGateway } from "./baileys-gateway";

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
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    const instance = await baileysGateway.createInstance(instanceName);
    return {
      instanceName,
      instanceId: instance.name,
      status: instance.observed_state,
    };
  }
  // _webhookUrl não é mais necessário (eventos são entregues in-process)
  const { instanceId, status } = startInstance(instanceName);
  return { instanceName, instanceId, status };
}

export async function connectInstance(
  instanceName: string,
): Promise<{ code: string; base64?: string; connectionStatus?: string }> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    await baileysGateway.createInstance(instanceName);
    return baileysGateway.connect(instanceName, true);
  }
  // Reinicia a instância com credenciais limpas para evitar conflito 401
  // device_removed causado por chaves Signal obsoletas no banco.
  // Se já estiver conectado, forceRestartInstance é no-op (não mexe no socket
  // real). Nesse caso não há QR a esperar — reportamos isso explicitamente
  // para o chamador não bloquear 30s por um QR que nunca vai chegar, e para
  // não sobrescrever o status do canal como se tivesse reiniciado.
  const restart = await forceRestartInstance(instanceName);
  if (restart.status === "connected" || restart.status === "open") {
    return { code: "", base64: undefined, connectionStatus: "connected" };
  }
  const qr = await waitForQr(instanceName, 30_000);
  if (!qr) return { code: "", base64: undefined };
  return { code: qr.code, base64: qr.base64 ?? undefined, connectionStatus: "qr" };
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    const instance = await baileysGateway.getInstance(instanceName);
    return { state: instance.observed_state };
  }
  return { state: getConnectionState(instanceName) };
}

export async function logoutInstance(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    await baileysGateway.logout(instanceName);
    return;
  }
  await smLogoutInstance(instanceName);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    await baileysGateway.deleteInstance(instanceName);
    return;
  }
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
  options: { delay?: number; quotedMsgId?: string; idempotencyKey?: string } = {},
): Promise<EvolutionSendResult> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    return baileysGateway.sendText(
      instanceName,
      { to, text, quotedMsgId: options.quotedMsgId },
      options.idempotencyKey ?? `crm-${randomUUID()}`,
    );
  }
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
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string; delay?: number; idempotencyKey?: string },
): Promise<EvolutionMediaResult> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    return baileysGateway.sendMedia(
      instanceName,
      {
        to,
        type: mediaType,
        url: opts.url,
        base64: opts.base64,
        filename: opts.filename,
        caption: opts.caption,
        mimetype: opts.mimetype,
      },
      opts.idempotencyKey ?? `crm-${randomUUID()}`,
    );
  }
  return smSendMedia(instanceName, to, mediaType, opts);
}

// ── Perfil do contato ────────────────────────────────────────────────────────

export async function fetchProfilePictureUrl(instanceName: string, phone: string): Promise<string | null> {
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (channel?.qrBackend === "gateway") {
    return baileysGateway.getProfilePicture(instanceName, phone);
  }
  return smGetProfilePictureUrl(instanceName, phone);
}
