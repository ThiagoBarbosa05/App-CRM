// Fachada de transporte Evolution API v2. O gateway Baileys permanece em seus
// arquivos originais para permitir rollback controlado.

import { randomUUID } from "node:crypto";
import { getChannelByEvolutionInstance } from "../services/whatsapp-channels.service";
import { normalizeToJid as normalizeJid } from "../services/baileys/jid";
import { applyChannelConnectionStatus } from "../services/baileys/connection-status.service";
import { buildEvolutionWebhookConfig, EvolutionApiError, evolutionApi, normalizeEvolutionQrData } from "./evolution-api";
import { baileysGateway } from "./baileys-gateway";

export { EvolutionApiError };

export { normalizeToJid, jidToPhone, isGroupJid } from "../services/baileys/jid";

export interface EvolutionInstanceInfo {
  instanceName: string;
  instanceId: string;
  status: string;
}

async function requireGatewayChannel(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) {
    throw new EvolutionApiError(`Canal QR "${instanceName}" não encontrado`, "not_found", 404);
  }
  if (channel.qrBackend !== "gateway" && channel.qrBackend !== "evolution_api") {
    throw new EvolutionApiError(
      `Canal QR "${instanceName}" não está configurado para a Evolution API`,
      "not_configured",
      409,
    );
  }
}

/**
 * O status persistido no CRM é apenas um cache visual. Antes de qualquer
 * operação que dependa do socket, consulta o estado observado pelo gateway.
 */
async function assertGatewayConnected(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) {
    throw new EvolutionApiError(`Canal QR "${instanceName}" não encontrado`, "not_found", 404);
  }

  try {
    if (channel?.qrBackend === "gateway") {
      const instance = await baileysGateway.getInstance(instanceName);
      if (instance.observed_state === "connected" && !instance.observed_state_stale) return;
    } else {
      const instance = await evolutionApi.getConnectionState(instanceName);
      if (instance.instance.state === "open") return;
    }

    // O status na tela precisa acompanhar a descoberta — antes o banco era
    // corrigido em silêncio e o usuário continuava vendo "Conectado".
    await applyChannelConnectionStatus(channel.id, "disconnected", {
      source: "send",
      occurredAt: new Date(),
      reasonLabel: "Evolution API reportou a sessão offline ao enviar",
    });
    throw new EvolutionApiError(
      `Canal QR "${instanceName}" está offline`,
      "unavailable",
      503,
    );
  } catch (error) {
    if (error instanceof EvolutionApiError && error.code === "not_found") {
      // O canal pode continuar existindo no CRM depois de a instância ser
      // removida/recriada no gateway. Nesse caso, o status salvo não é mais
      // confiável e a sessão precisa ser pareada novamente.
      await applyChannelConnectionStatus(channel.id, "disconnected", {
        source: "send",
        occurredAt: new Date(),
        reasonCode: "INSTANCE_NOT_FOUND",
        reasonLabel: "Instância do canal não existe no Baileys Gateway; reconecte via QR Code",
      });
      throw new EvolutionApiError(
        `Instância do canal QR "${instanceName}" não existe no gateway. Reconecte via QR Code.`,
        "unavailable",
        503,
      );
    }
    if (error instanceof EvolutionApiError) throw error;
    // Indisponibilidade do gateway não prova que o WhatsApp caiu. Não altera
    // o status persistido para evitar falsos negativos durante deploy/rede.
    throw error;
  }
}

export async function createInstance(
  instanceName: string,
  _webhookUrl?: string,
): Promise<EvolutionInstanceInfo> {
  await requireGatewayChannel(instanceName);
  const instance = await evolutionApi.createInstance(instanceName, _webhookUrl ?? process.env.EVOLUTION_WEBHOOK_URL);
  return { instanceName, instanceId: instance.instance.instanceName, status: instance.instance.status };
}

export async function connectInstance(
  instanceName: string,
): Promise<{ code: string; base64?: string; connectionStatus?: string }> {
  await requireGatewayChannel(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") {
    const qr = await baileysGateway.connect(instanceName, true);
    return qr;
  }
  const webhookUrl = process.env.EVOLUTION_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    throw new EvolutionApiError("EVOLUTION_WEBHOOK_URL é obrigatória para conectar canais pela Evolution API", "not_configured");
  }
  let qr: Awaited<ReturnType<typeof evolutionApi.connect>>;
  try {
    qr = await evolutionApi.connect(instanceName);
  } catch (error) {
    if (!(error instanceof EvolutionApiError) || error.code !== "not_found") throw error;
    await evolutionApi.createInstance(instanceName, process.env.EVOLUTION_WEBHOOK_URL);
    qr = await evolutionApi.connect(instanceName);
  }
  try {
    await evolutionApi.setWebhook(instanceName, buildEvolutionWebhookConfig(webhookUrl));
  } catch (error) {
    console.error(`[Evolution] Falha ao sincronizar webhook obrigatório da instância "${instanceName}":`, error);
    throw error;
  }
  const normalizedQr = normalizeEvolutionQrData(qr);
  const code = normalizedQr.code ?? "";
  return {
    code,
    base64: normalizedQr.base64 ?? undefined,
    connectionStatus: code || normalizedQr.base64 ? "qr" : undefined,
  };
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  await requireGatewayChannel(instanceName);
  const instance = await evolutionApi.getConnectionState(instanceName);
  return { state: instance.instance.state };
}

export async function logoutInstance(instanceName: string): Promise<void> {
  await requireGatewayChannel(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") await baileysGateway.logout(instanceName);
  else await evolutionApi.logout(instanceName);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await requireGatewayChannel(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") await baileysGateway.deleteInstance(instanceName);
  else await evolutionApi.deleteInstance(instanceName);
}

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
  await requireGatewayChannel(instanceName);
  await assertGatewayConnected(instanceName);
  try {
    const channel = await getChannelByEvolutionInstance(instanceName);
    if (channel?.qrBackend === "gateway") {
      return await baileysGateway.sendText(instanceName, { to, text, quotedMsgId: options.quotedMsgId }, options.idempotencyKey ?? `crm-${randomUUID()}`);
    }
    return await evolutionApi.sendText(
      instanceName,
      { to, text, quotedMsgId: options.quotedMsgId },
      options.idempotencyKey ?? `crm-${randomUUID()}`,
    );
  } catch (error) {
    if (error instanceof EvolutionApiError && (error.code === "unavailable" || error.code === "not_found")) {
      const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
      if (channel) {
        await applyChannelConnectionStatus(channel.id, "disconnected", {
          source: "send",
          occurredAt: new Date(),
          reasonLabel: "Gateway recusou o envio: sessão offline",
        });
      }
    }
    throw error;
  }
}

export interface EvolutionMediaResult {
  key: { remoteJid: string; fromMe: boolean; id: string };
  status: string;
}

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video" | "sticker",
  opts: {
    url?: string;
    base64?: string;
    filename?: string;
    caption?: string;
    mimetype?: string;
    delay?: number;
    idempotencyKey?: string;
    quotedMsgId?: string;
    ptt?: boolean;
  },
): Promise<EvolutionMediaResult> {
  await requireGatewayChannel(instanceName);
  await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") {
    return await baileysGateway.sendMedia(instanceName, { to, type: mediaType, url: opts.url, base64: opts.base64, filename: opts.filename, caption: opts.caption, mimetype: opts.mimetype, quotedMsgId: opts.quotedMsgId, ptt: opts.ptt }, opts.idempotencyKey ?? `crm-${randomUUID()}`);
  }
  if (mediaType === "audio" && opts.ptt && (opts.url || opts.base64)) {
    return evolutionApi.sendAudio(instanceName, { to, audio: opts.url ?? opts.base64!, quotedMsgId: opts.quotedMsgId }, opts.idempotencyKey);
  }
  return evolutionApi.sendMedia(
    instanceName,
    {
      to,
      type: mediaType,
      url: opts.url,
      base64: opts.base64,
      filename: opts.filename,
      caption: opts.caption,
      mimetype: opts.mimetype,
      quotedMsgId: opts.quotedMsgId,
      ptt: opts.ptt,
    },
    opts.idempotencyKey ?? `crm-${randomUUID()}`,
  );
}

export async function sendLocation(instanceName: string, to: string, location: { latitude: number; longitude: number; name?: string; address?: string }, idempotencyKey?: string): Promise<EvolutionSendResult> {
  await requireGatewayChannel(instanceName); await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") return baileysGateway.sendLocation(instanceName, { to, ...location }, idempotencyKey ?? `crm-${randomUUID()}`);
  return evolutionApi.sendLocation(instanceName, { to, ...location }, idempotencyKey);
}

export async function sendContacts(instanceName: string, to: string, contacts: Array<{ displayName: string; vcard: string }>, idempotencyKey?: string): Promise<EvolutionSendResult> {
  await requireGatewayChannel(instanceName); await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") return baileysGateway.sendContacts(instanceName, { to, contacts }, idempotencyKey ?? `crm-${randomUUID()}`);
  return evolutionApi.sendContacts(instanceName, { to, contacts }, idempotencyKey);
}

export async function sendPoll(instanceName: string, to: string, poll: { name: string; values: string[]; selectableCount?: number }, idempotencyKey?: string): Promise<EvolutionSendResult> {
  await requireGatewayChannel(instanceName); await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") return baileysGateway.sendPoll(instanceName, { to, name: poll.name, values: poll.values, selectableCount: poll.selectableCount }, idempotencyKey ?? `crm-${randomUUID()}`);
  return evolutionApi.sendPoll(instanceName, { to, name: poll.name, values: poll.values, selectableCount: poll.selectableCount }, idempotencyKey);
}

export async function markMessagesRead(instanceName: string, messages: Array<{ remoteJid: string; fromMe: boolean; id: string; participant?: string }>): Promise<void> {
  await requireGatewayChannel(instanceName); await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") { await baileysGateway.readMessages(instanceName, messages); return; }
  await evolutionApi.readMessages(instanceName, messages);
}

export async function publishPresence(instanceName: string, to: string, presence: "available" | "unavailable" | "composing" | "recording" | "paused"): Promise<void> {
  await requireGatewayChannel(instanceName); await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") { await baileysGateway.sendPresence(instanceName, to, presence); return; }
  await evolutionApi.sendPresence(instanceName, { to, presence });
}

export async function sendReaction(
  instanceName: string,
  to: string,
  messageId: string,
  emoji: string,
  idempotencyKey?: string,
  targetFromMe = false,
): Promise<EvolutionSendResult> {
  await requireGatewayChannel(instanceName);
  await assertGatewayConnected(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") return baileysGateway.sendReaction(instanceName, { to, messageId, emoji }, idempotencyKey ?? `crm-${randomUUID()}`);
  return evolutionApi.sendReaction(instanceName, { remoteJid: normalizeJid(to), fromMe: targetFromMe, id: messageId, reaction: emoji }, idempotencyKey);
}

export async function fetchProfilePictureUrl(
  instanceName: string,
  phone: string,
): Promise<string | null> {
  await requireGatewayChannel(instanceName);
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (channel?.qrBackend === "gateway") return baileysGateway.getProfilePicture(instanceName, phone);
  try {
    const result = await evolutionApi.fetchProfilePicture(instanceName, phone);
    return typeof result.profilePictureUrl === "string" ? result.profilePictureUrl : null;
  } catch (error) {
    console.warn(`[Evolution] Falha ao obter foto de perfil:`, error instanceof Error ? error.message : error);
    return null;
  }
}
