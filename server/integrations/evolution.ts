// Camada de compatibilidade "Evolution". Os nomes públicos permanecem, mas
// canais QR são atendidos exclusivamente pelo Baileys Gateway dedicado.

import { randomUUID } from "node:crypto";
import { getChannelByEvolutionInstance } from "../services/whatsapp-channels.service";
import { applyChannelConnectionStatus } from "../services/baileys/connection-status.service";
import { BaileysGatewayError, baileysGateway } from "./baileys-gateway";

export { normalizeToJid, jidToPhone, isGroupJid } from "../services/baileys/jid";

export interface EvolutionInstanceInfo {
  instanceName: string;
  instanceId: string;
  status: string;
}

async function requireGatewayChannel(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) {
    throw new BaileysGatewayError(`Canal QR "${instanceName}" não encontrado`, "not_found", 404);
  }
  if (channel.qrBackend !== "gateway") {
    throw new BaileysGatewayError(
      `Canal QR "${instanceName}" não está configurado para o gateway`,
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
    throw new BaileysGatewayError(`Canal QR "${instanceName}" não encontrado`, "not_found", 404);
  }

  try {
    const instance = await baileysGateway.getInstance(instanceName);
    if (instance.observed_state === "connected" && !instance.observed_state_stale) return;

    // O status na tela precisa acompanhar a descoberta — antes o banco era
    // corrigido em silêncio e o usuário continuava vendo "Conectado".
    await applyChannelConnectionStatus(channel.id, "disconnected", {
      source: "send",
      occurredAt: new Date(),
      reasonLabel: instance.observed_state_stale
        ? "Gateway parou de responder pela sessão"
        : "Gateway reportou a sessão offline ao enviar",
    });
    throw new BaileysGatewayError(
      `Canal QR "${instanceName}" está ${instance.observed_state}`,
      "channel_offline",
      503,
    );
  } catch (error) {
    if (error instanceof BaileysGatewayError && error.code === "not_found") {
      // O canal pode continuar existindo no CRM depois de a instância ser
      // removida/recriada no gateway. Nesse caso, o status salvo não é mais
      // confiável e a sessão precisa ser pareada novamente.
      await applyChannelConnectionStatus(channel.id, "disconnected", {
        source: "send",
        occurredAt: new Date(),
        reasonCode: "INSTANCE_NOT_FOUND",
        reasonLabel: "Instância do canal não existe no Baileys Gateway; reconecte via QR Code",
      });
      throw new BaileysGatewayError(
        `Instância do canal QR "${instanceName}" não existe no gateway. Reconecte via QR Code.`,
        "channel_offline",
        503,
      );
    }
    if (error instanceof BaileysGatewayError) throw error;
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
  const instance = await baileysGateway.createInstance(instanceName);
  return { instanceName, instanceId: instance.name, status: instance.observed_state };
}

export async function connectInstance(
  instanceName: string,
): Promise<{ code: string; base64?: string; connectionStatus?: string }> {
  await requireGatewayChannel(instanceName);
  await baileysGateway.createInstance(instanceName);
  return baileysGateway.connect(instanceName, true);
}

export async function getInstanceStatus(instanceName: string): Promise<{ state: string }> {
  await requireGatewayChannel(instanceName);
  const instance = await baileysGateway.getInstance(instanceName);
  return { state: instance.observed_state };
}

export async function logoutInstance(instanceName: string): Promise<void> {
  await requireGatewayChannel(instanceName);
  await baileysGateway.logout(instanceName);
}

export async function deleteInstance(instanceName: string): Promise<void> {
  await requireGatewayChannel(instanceName);
  await baileysGateway.deleteInstance(instanceName);
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
    return await baileysGateway.sendText(
      instanceName,
      { to, text, quotedMsgId: options.quotedMsgId },
      options.idempotencyKey ?? `crm-${randomUUID()}`,
    );
  } catch (error) {
    if (error instanceof BaileysGatewayError && (error.code === "channel_offline" || error.code === "not_found")) {
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
  },
): Promise<EvolutionMediaResult> {
  await requireGatewayChannel(instanceName);
  await assertGatewayConnected(instanceName);
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
      quotedMsgId: opts.quotedMsgId,
    },
    opts.idempotencyKey ?? `crm-${randomUUID()}`,
  );
}

export async function sendReaction(
  instanceName: string,
  to: string,
  messageId: string,
  emoji: string,
  idempotencyKey?: string,
): Promise<EvolutionSendResult> {
  await requireGatewayChannel(instanceName);
  await assertGatewayConnected(instanceName);
  return baileysGateway.sendReaction(
    instanceName,
    { to, messageId, emoji },
    idempotencyKey ?? `crm-${randomUUID()}`,
  );
}

export async function fetchProfilePictureUrl(
  instanceName: string,
  phone: string,
): Promise<string | null> {
  await requireGatewayChannel(instanceName);
  return baileysGateway.getProfilePicture(instanceName, phone);
}
