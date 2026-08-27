import { getChannelByEvolutionInstance, updateChannel, isSameChannelPhone } from "./whatsapp-channels.service";
import { saveInboundMessage, saveInboundReaction } from "./whatsapp-conversations.service";
import { publishConversationEvent, publishSseEvent } from "../lib/sse-hub";
import { jidToPhone, isIgnorableJid } from "./baileys/jid";
import { sendText as evoSendText } from "../integrations/evolution";
import {
  optOutClientByPhone,
  optInClientByPhone,
  matchOptKeyword,
  OPT_OUT_CONFIRMATION_TEXT,
  OPT_IN_CONFIRMATION_TEXT,
} from "./whatsapp-opt-out.service";
import { handleInboundBotMessage, persistBotMessage } from "./whatsapp-bot-engine.service";
import {
  applyChannelConnectionStatus,
  getSseTargetUserIds,
  type ChannelConnectionStatus,
} from "./baileys/connection-status.service";
import { applyCampaignDeliveryStatus } from "./whatsapp-campaign-status.service";
import { parseWhatsappFlattenedReply } from "@shared/whatsapp-flattened-reply";

export function extractQuotedMessageSnapshot(message: Record<string, unknown> | undefined): {
  content: string | null;
  type: string;
} | null {
  if (!message) return null;
  if (typeof message.conversation === "string") return { content: message.conversation, type: "text" };

  const extended = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (extended) return { content: typeof extended.text === "string" ? extended.text : null, type: "text" };

  const mediaTypes = [
    ["imageMessage", "image"],
    ["audioMessage", "audio"],
    ["pttMessage", "audio"],
    ["videoMessage", "video"],
    ["documentMessage", "document"],
    ["stickerMessage", "sticker"],
  ] as const;
  for (const [key, type] of mediaTypes) {
    const media = message[key] as Record<string, unknown> | undefined;
    if (!media) continue;
    const content = typeof media.caption === "string"
      ? media.caption
      : type === "document" && typeof media.fileName === "string"
        ? media.fileName
        : "";
    return { content, type };
  }
  return null;
}

// Eventos do Baileys são processados in-process (sem webhook HTTP). Os nomes de
// evento SSE e o shape dos payloads são preservados para não quebrar o frontend.

// ── messages.upsert ────────────────────────────────────────────────────────────

export async function handleMessagesUpsert(instanceName: string, data: unknown) {
  const msg = data as {
    key: { remoteJid: string; fromMe: boolean; id: string };
    message?: Record<string, unknown>;
    messageType?: string;
    messageTimestamp?: number;
    pushName?: string;
    _baileysMedia?: {
      storageKey: string;
      mimeType: string;
      filename: string | null;
      size: number;
    };
  };

  const jid = msg.key?.remoteJid;
  if (isIgnorableJid(jid)) return;

  const waMessageId = msg.key.id;
  const fromMe = msg.key.fromMe === true;
  const phone = jidToPhone(jid);
  const pushName = msg.pushName?.trim() || undefined;

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) {
    console.warn(`[Baileys Events] Instância "${instanceName}" não encontrada no banco`);
    return;
  }

  // Ignora só o auto-echo deste MESMO canal (ex.: dispositivo vinculado via
  // Evolution espelhando de volta uma mensagem que o próprio número do canal
  // enviou). NÃO compara contra os demais canais da empresa: um canal
  // diferente mandando mensagem de verdade para este número (ex.: repasse
  // entre setores) é uma conversa legítima e deve seguir normalmente para
  // saveInboundMessage, virando uma conversa comum no inbox deste canal.
  if (isSameChannelPhone(channel.displayPhone, phone)) {
    console.warn(
      `[Baileys Events] Mensagem de "${phone}" ignorada por ser eco do próprio número do canal "${channel.name}" (instância "${instanceName}", id ${channel.id}).`,
    );
    return;
  }

  const msgContent = msg.message ?? {};
  const reaction = msgContent.reactionMessage as {
    key?: { id?: string };
    text?: string | null;
  } | undefined;
  if (reaction?.key?.id) {
    await saveInboundReaction({
      phone,
      waMessageId: reaction.key.id,
      emoji: reaction.text ?? "",
      channelId: channel.id,
      direction: fromMe ? "outbound" : "inbound",
    });
    return;
  }

  const contentNode = (
    (msgContent.extendedTextMessage ??
      msgContent.imageMessage ??
      msgContent.audioMessage ??
      msgContent.pttMessage ??
      msgContent.videoMessage ??
      msgContent.documentMessage ??
      msgContent.stickerMessage) as Record<string, unknown> | undefined
  );
  const contextInfo = contentNode?.contextInfo as {
    stanzaId?: string;
    participant?: string;
    quotedMessage?: Record<string, unknown>;
    isForwarded?: boolean;
    forwardingScore?: number;
  } | undefined;
  const quotedSnapshot = extractQuotedMessageSnapshot(contextInfo?.quotedMessage);
  const quotedParticipantPhone = contextInfo?.participant
    ? jidToPhone(contextInfo.participant)
    : null;
  const quotedDirection: "inbound" | "outbound" | undefined = quotedSnapshot
    ? quotedParticipantPhone
      ? isSameChannelPhone(channel.displayPhone, quotedParticipantPhone) ? "outbound" : "inbound"
      : fromMe ? "inbound" : "outbound"
    : undefined;
  const text =
    (msgContent.conversation as string | undefined) ??
    ((msgContent.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ??
    (contentNode?.caption as string | undefined) ??
    null;
  const flattenedReply = quotedSnapshot ? null : parseWhatsappFlattenedReply(text);
  const effectiveQuotedContent = quotedSnapshot?.content ?? flattenedReply?.quotedContent;
  const effectiveQuotedType = quotedSnapshot?.type ?? (flattenedReply ? "text" : undefined);
  const effectiveQuotedDirection = quotedDirection ?? (flattenedReply
    ? fromMe ? "inbound" : "outbound"
    : undefined);
  const effectiveText = flattenedReply?.content ?? text;

  // Tipo de mensagem
  let type = "text";
  if (msgContent.imageMessage) type = "image";
  else if (msgContent.audioMessage || msgContent.pttMessage) type = "audio";
  else if (msgContent.videoMessage) type = "video";
  else if (msgContent.documentMessage) type = "document";
  else if (msgContent.stickerMessage) type = "sticker";

  const caption = ["image", "video", "document"].includes(type)
    ? (contentNode?.caption as string | undefined)
    : undefined;
  const persistedContent = caption === undefined ? effectiveText : null;

  // Ignora mensagens de protocolo/sync (distribuição de chaves, app-state, etc.)
  // que o WhatsApp envia em rajada ao parear via QR — elas serializam vazias e
  // seriam salvas como "[text]" em massa.
  if (!effectiveText && type === "text" && !msg._baileysMedia) return;

  const timestamp = msg.messageTimestamp
    ? String(msg.messageTimestamp)
    : undefined;

  const inboundResult = await saveInboundMessage({
    phone,
    content: persistedContent,
    caption,
    type,
    waMessageId,
    timestamp,
    channelId: channel.id,
    rawPayload: msg as Record<string, unknown>,
    replyToWaMessageId: contextInfo?.stanzaId,
    replyToContentSnapshot: effectiveQuotedContent,
    replyToTypeSnapshot: effectiveQuotedType,
    replyToDirectionSnapshot: effectiveQuotedDirection,
    isForwarded: contextInfo?.isForwarded === true || (contextInfo?.forwardingScore ?? 0) > 0,
    providerMetadata: contextInfo
      ? {
          forwardingScore: contextInfo.forwardingScore ?? 0,
        }
      : undefined,
    _fromMe: fromMe,
    // Remetente real: no eco fromMe é o próprio número do canal. É o que
    // permite derivar a direção quando os dois lados da conversa são canais
    // nossos e compartilham UMA única conversa.
    senderPhone: fromMe ? (channel.displayPhone ?? undefined) : phone,
    // Em fromMe o Baileys manda o pushName da própria conta conectada (o nome
    // do canal/atendente) — usá-lo batizaria o contato com o nome errado.
    pushName: fromMe ? undefined : pushName,
    instanceName,
    mediaData: msg._baileysMedia
      ? {
          storageKey: msg._baileysMedia.storageKey,
          mimeType: msg._baileysMedia.mimeType,
          filename: msg._baileysMedia.filename ?? undefined,
          size: msg._baileysMedia.size,
        }
      : undefined,
  }).catch((err) => {
    console.error("[Baileys Events] Erro ao salvar mensagem:", err);
    return null;
  });

  // Opt-out/opt-in de marketing via palavra-chave, mesmo mecanismo do webhook
  // da Cloud API (ver server/routes/whatsapp-webhook.routes.ts) — necessário
  // aqui também porque mensagens de canais QR Code (Evolution/Baileys) não
  // passam por aquele webhook.
  let handledOptKeyword = false;
  if (!fromMe && text) {
    const match = matchOptKeyword(text);
    if (match === "opt_out") {
      handledOptKeyword = true;
      await optOutClientByPhone(phone, "keyword").catch((err) =>
        console.error("[Baileys Events] Erro ao processar opt-out:", err),
      );
      const result = await evoSendText(instanceName, phone, OPT_OUT_CONFIRMATION_TEXT).catch((err) => {
        console.error("[Baileys Events] Erro ao enviar confirmação de opt-out:", err);
        return null;
      });
      await persistBotMessage(phone, {
        waMessageId: result?.key?.id ?? null,
        type: "text",
        content: OPT_OUT_CONFIRMATION_TEXT,
      });
    } else if (match === "opt_in") {
      handledOptKeyword = true;
      await optInClientByPhone(phone).catch((err) =>
        console.error("[Baileys Events] Erro ao processar opt-in:", err),
      );
      const result = await evoSendText(instanceName, phone, OPT_IN_CONFIRMATION_TEXT).catch((err) => {
        console.error("[Baileys Events] Erro ao enviar confirmação de opt-in:", err);
        return null;
      });
      await persistBotMessage(phone, {
        waMessageId: result?.key?.id ?? null,
        type: "text",
        content: OPT_IN_CONFIRMATION_TEXT,
      });
    }
  }

  if (!fromMe && !handledOptKeyword && inboundResult?.saved) {
    await handleInboundBotMessage({
      phone,
      messageText: text,
      channelId: inboundResult.channelId,
      startsConversation: inboundResult.startsConversation,
    });
  }
}

export async function handleMessagesReaction(instanceName: string, data: unknown) {
  const event = data as {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    reaction?: {
      key?: { remoteJid?: string; fromMe?: boolean; id?: string };
      text?: string | null;
    };
  };
  // No evento `messages.reaction` do Baileys, `event.key` é a mensagem que
  // recebeu a reação. `event.reaction.key` é a mensagem-protocolo da própria
  // reação e informa quem reagiu. Usar o segundo id procura uma mensagem que
  // não existe no CRM e fazia a reação sumir silenciosamente.
  const targetId = event.key?.id;
  const jid = event.key?.remoteJid ?? event.reaction?.key?.remoteJid;
  if (!targetId || !jid || isIgnorableJid(jid)) return;
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;
  await saveInboundReaction({
    phone: jidToPhone(jid),
    waMessageId: targetId,
    emoji: event.reaction?.text ?? "",
    channelId: channel.id,
    direction: event.reaction?.key?.fromMe ? "outbound" : "inbound",
  });
}

// ── messages.update ────────────────────────────────────────────────────────────

// Erro 463 do Baileys ("account restricted or missing tctoken") — WhatsApp
// bloqueia novos "reach-outs" para o número. Não há retry possível: reenviar
// conta como novo reach-out e piora a restrição (ver docs/diagnostico-canal-eventos-erro-463.md).
const ACCOUNT_RESTRICTION_MARKERS = ["463", "Your account has been restricted"];

function isAccountRestrictionError(messageStubParameters: unknown): boolean {
  if (!Array.isArray(messageStubParameters)) return false;
  return messageStubParameters.some(
    (p) => typeof p === "string" && ACCOUNT_RESTRICTION_MARKERS.includes(p),
  );
}

export async function handleMessagesUpdate(data: unknown) {
  const updates = Array.isArray(data) ? data : [data];
  for (const update of updates) {
    const u = update as {
      key?: { id?: string };
      update?: { status?: string; messageStubParameters?: unknown };
    };
    const waMessageId = u.key?.id;
    const status = u.update?.status?.toLowerCase();
    if (!waMessageId || !status) continue;

    // Mapeia status do Baileys para os valores do schema
    const statusMap: Record<string, string> = {
      delivery_ack: "delivered",
      read: "read",
      played: "read",
      error: "failed",
    };
    const mapped = statusMap[status] ?? status;
    if (!["sent", "delivered", "read", "failed"].includes(mapped)) continue;

    const statusReason =
      mapped === "failed" && isAccountRestrictionError(u.update?.messageStubParameters)
        ? "account_restricted"
        : undefined;

    const { db } = await import("../db");
    const { whatsappMessages } = await import("../../shared/schema");
    const { and, eq, ne } = await import("drizzle-orm");
    const eventAt = new Date();
    const [updated] = await db
      .update(whatsappMessages)
      .set({
        status: mapped as "sent" | "delivered" | "read" | "failed",
        ...(mapped === "delivered" ? { deliveredAt: eventAt } : {}),
        ...(mapped === "read" ? { deliveredAt: eventAt, readAt: eventAt } : {}),
        ...(statusReason ? { statusReason } : {}),
      })
      .where(
        mapped === "sent"
          ? and(
              eq(whatsappMessages.waMessageId, waMessageId),
              ne(whatsappMessages.status, "delivered"),
              ne(whatsappMessages.status, "read"),
            )
          : mapped === "delivered"
          ? and(
              eq(whatsappMessages.waMessageId, waMessageId),
              ne(whatsappMessages.status, "read"),
            )
          : eq(whatsappMessages.waMessageId, waMessageId),
      )
      .returning({
        id: whatsappMessages.id,
        conversationId: whatsappMessages.conversationId,
      })
      .catch((err): Array<{ id: string; conversationId: string }> => {
        console.error("[Baileys Events] Erro ao atualizar status:", err);
        return [];
      });
    if (updated) {
      publishConversationEvent(updated.conversationId, "message_status", {
        messageId: updated.id,
        status: mapped,
      });
    }

    // Independente de o UPDATE acima de whatsapp_messages ter afetado alguma
    // linha (seu WHERE tem sua própria regra de monotonicidade, ex: não
    // regride de "read" pra "delivered") — a campanha tem sua PRÓPRIA checagem
    // de rank interna em applyCampaignDeliveryStatus, então é chamada sempre.
    applyCampaignDeliveryStatus(
      waMessageId,
      mapped as "sent" | "delivered" | "read" | "failed",
      { eventAt, errorMessage: statusReason },
    ).catch((err) =>
      console.error("[Baileys Events] Erro ao atualizar status de campanha:", err),
    );
  }
}

// ── connection.update ──────────────────────────────────────────────────────────

export async function handleConnectionUpdate(
  instanceName: string,
  data: unknown,
  occurredAt?: Date,
) {
  const update = data as {
    state?: string;
    phone?: string;
    reasonCode?: string;
    reasonLabel?: string;
    logEvent?: boolean;
  };
  const state = update.state ?? "disconnected";

  const stateMap: Record<string, ChannelConnectionStatus> = {
    open: "connected",
    connecting: "connecting",
    close: "disconnected",
    closed: "disconnected",
    // O gateway marca `failed` (ex.: SESSION_INVALID após loggedOut) e
    // `lock_wait` (sessão presa em outra réplica); nenhum dos dois é um estado
    // exibível — para o CRM, o canal está fora do ar ou tentando subir.
    failed: "disconnected",
    lock_wait: "connecting",
    qr: "qr",
  };
  const connectionStatus = stateMap[state] ?? "disconnected";

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;

  // Persiste status + histórico + SSE num único ponto (ver
  // baileys/connection-status.service). `logEvent: false` é usado pelo gateway
  // para o restart automático pós-pareamento (515) e para ruído operacional
  // (deploy, lock) — muda o status sem sujar o histórico do vendedor.
  await applyChannelConnectionStatus(channel.id, connectionStatus, {
    source: "webhook",
    occurredAt,
    reasonCode: update.reasonCode,
    reasonLabel: update.reasonLabel,
    logEvent: update.logEvent,
  });

  // Ao conectar via QR, salva o número real do WhatsApp no displayPhone (somente
  // se ainda não estiver preenchido — preserva valor definido manualmente).
  if (connectionStatus === "connected" && update.phone && !channel.displayPhone) {
    await updateChannel(channel.id, { displayPhone: `+${update.phone}` }).catch(() => {});
  }
}

// ── qrcode.updated ─────────────────────────────────────────────────────────────

export async function handleQrcodeUpdated(
  instanceName: string,
  data: unknown,
  occurredAt?: Date,
) {
  const qrData = data as { qrcode?: { base64?: string; code?: string } };
  const base64 = qrData.qrcode?.base64 ?? null;
  const code = qrData.qrcode?.code ?? null;

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;

  // O QR expira e é regerado a cada ~20s: registrar cada um no histórico o
  // encheria de ruído. O status muda (e vai por SSE); o histórico, não.
  await applyChannelConnectionStatus(channel.id, "qr", {
    source: "webhook",
    occurredAt,
    logEvent: false,
  });

  // Empurra QR para a tela de quem pode conectar este canal via SSE
  const targetUserIds = await getSseTargetUserIds(channel);
  for (const userId of targetUserIds) {
    publishSseEvent("evolution_qr_updated", { instanceName, base64, code }, userId);
  }
}
