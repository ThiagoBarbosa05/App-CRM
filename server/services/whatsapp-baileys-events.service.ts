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
import { auditStatus, normalizeGatewayMessageKey } from "./whatsapp-message-audit.service";

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

type BaileysRichMessage = {
  type: "location" | "contacts" | "poll";
  content: string | null;
  providerMetadata: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/**
 * Mantém dados ricos do Baileys estruturados no metadata. `content` é apenas
 * uma prévia pesquisável; nunca é a única representação da mensagem.
 */
export function extractBaileysRichMessage(message: Record<string, unknown>): BaileysRichMessage | null {
  const location = asRecord(message.locationMessage) ?? asRecord(message.liveLocationMessage);
  if (location) {
    const latitude = typeof location.degreesLatitude === "number" ? location.degreesLatitude : null;
    const longitude = typeof location.degreesLongitude === "number" ? location.degreesLongitude : null;
    const name = typeof location.name === "string" ? location.name : null;
    const address = typeof location.address === "string" ? location.address : null;
    return {
      type: "location",
      content: name ?? address,
      providerMetadata: {
        location: { latitude, longitude, name, address },
        structuredContent: {
          kind: "location",
          latitude,
          longitude,
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
        },
      },
    };
  }

  const contactsArray = asRecord(message.contactsArrayMessage);
  const singleContact = asRecord(message.contactMessage);
  if (contactsArray || singleContact) {
    const rawContacts = contactsArray?.contacts;
    const contacts = Array.isArray(rawContacts)
      ? rawContacts.map(asRecord).filter((contact): contact is Record<string, unknown> => contact !== undefined)
      : singleContact ? [singleContact] : [];
    const displayName = typeof contactsArray?.displayName === "string"
      ? contactsArray.displayName
      : typeof singleContact?.displayName === "string" ? singleContact.displayName : null;
    return {
      type: "contacts",
      content: displayName,
      providerMetadata: {
        contacts,
        structuredContent: {
          kind: "contacts",
          contacts: contacts.map((contact) => ({
            ...(typeof contact.displayName === "string"
              ? { name: { formatted_name: contact.displayName } }
              : {}),
            ...contact,
          })),
        },
      },
    };
  }

  const poll = asRecord(message.pollCreationMessage) ?? asRecord(message.pollCreationMessageV2) ?? asRecord(message.pollCreationMessageV3);
  if (poll) {
    const options = Array.isArray(poll.options)
      ? poll.options
          .map(asRecord)
          .map((option) => typeof option?.optionName === "string" ? option.optionName : null)
          .filter((option): option is string => option !== null)
      : [];
    const name = typeof poll.name === "string" ? poll.name : null;
    const selectableCount = typeof poll.selectableOptionsCount === "number"
      ? poll.selectableOptionsCount
      : 1;
    return {
      type: "poll",
      content: name,
      providerMetadata: {
        poll: { options, selectableCount },
        structuredContent: {
          kind: "poll",
          poll: {
            name: name ?? "",
            options: options.map((option) => ({ name: option })),
            selectableOptionsCount: selectableCount,
          },
        },
      },
    };
  }

  const pollUpdate = asRecord(message.pollUpdateMessage);
  if (pollUpdate) {
    const pollCreationMessageKey = asRecord(pollUpdate.pollCreationMessageKey);
    const vote = asRecord(pollUpdate.vote);
    return {
      type: "poll",
      content: "Voto em enquete",
      providerMetadata: {
        pollVote: {
          pollMessageId: typeof pollCreationMessageKey?.id === "string" ? pollCreationMessageKey.id : null,
          selectedOptions: Array.isArray(vote?.selectedOptions)
            ? vote.selectedOptions.flatMap((option) => option instanceof Uint8Array
                ? [Buffer.from(option).toString("base64")]
                : typeof option === "string" ? [option] : [])
            : [],
        },
      },
    };
  }

  return null;
}

// Eventos do Baileys são processados in-process (sem webhook HTTP). Os nomes de
// evento SSE e o shape dos payloads são preservados para não quebrar o frontend.

// ── messages.upsert ────────────────────────────────────────────────────────────

export async function handleMessagesUpsert(instanceName: string, data: unknown) {
  const msg = data as {
    key: { remoteJid: string; remoteJidAlt?: string; participant?: string; participantAlt?: string; addressingMode?: string; fromMe: boolean; id: string };
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
  if (jid === "status@broadcast") {
    await auditStatus(instanceName, data);
    return;
  }
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
  const protocol = asRecord(msgContent.protocolMessage);
  const protocolKey = asRecord(protocol?.key);
  if (protocol?.type === 0 && typeof protocolKey?.id === "string") {
    await handleMessagesDelete({ keys: [{ id: protocolKey.id }] });
    return;
  }
  if (protocol?.type === 14 && typeof protocolKey?.id === "string") {
    const editedMessage = asRecord(protocol.editedMessage);
    if (editedMessage) await handleMessageEdit(protocolKey.id, editedMessage);
    return;
  }
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

  const richMessage = extractBaileysRichMessage(msgContent) ?? (() => {
    const unsupported = asRecord(msgContent.unsupportedMessage);
    if (!unsupported) return null;
    const keys = Array.isArray(unsupported.keys)
      ? unsupported.keys.filter((key): key is string => typeof key === "string")
      : [];
    return {
      type: "unsupported" as const,
      content: `Formato não suportado${keys.length ? `: ${keys.join(", ")}` : ""}`,
      providerMetadata: { unsupported },
    };
  })();
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
    richMessage?.content ??
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
  else if (richMessage) type = richMessage.type;

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
    providerMetadata: contextInfo || richMessage
      ? {
          ...(contextInfo ? { forwardingScore: contextInfo.forwardingScore ?? 0 } : {}),
          ...(richMessage?.providerMetadata ?? {}),
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

// ── messages.delete ────────────────────────────────────────────────────────────

/** Mantém a linha para auditoria, mas remove o conteúdo que o WhatsApp revogou. */
export async function handleMessagesDelete(data: unknown): Promise<void> {
  const event = data as { keys?: Array<{ id?: string }> };
  const keys = event.keys ?? [];
  if (!Array.isArray(keys)) return;

  const { db } = await import("../db");
  const { whatsappMessages } = await import("../../shared/schema");
  const { eq } = await import("drizzle-orm");
  for (const key of keys) {
    if (!key.id) continue;
    const updated = await db
      .update(whatsappMessages)
      .set({ type: "deleted", content: null, caption: null, deletedAt: new Date() })
      .where(eq(whatsappMessages.waMessageId, key.id))
      .returning({ id: whatsappMessages.id, conversationId: whatsappMessages.conversationId })
      .catch((err): Array<{ id: string; conversationId: string }> => {
        console.error("[Baileys Events] Erro ao marcar mensagem removida:", err);
        return [];
      });
    for (const message of updated) {
      publishConversationEvent(message.conversationId, "message_deleted", { messageId: message.id });
    }
  }
}

/** Aplica uma edição do protocolo Baileys à mensagem original, sem criar duplicata. */
export async function handleMessageEdit(waMessageId: string, editedMessage: Record<string, unknown>): Promise<void> {
  const editedWrapper = asRecord(editedMessage.editedMessage);
  const nestedEdited = asRecord(editedWrapper?.message);
  if (nestedEdited) editedMessage = nestedEdited;
  const rich = extractBaileysRichMessage(editedMessage);
  const extended = asRecord(editedMessage.extendedTextMessage);
  const image = asRecord(editedMessage.imageMessage);
  const video = asRecord(editedMessage.videoMessage);
  const document = asRecord(editedMessage.documentMessage);
  const text = typeof editedMessage.conversation === "string"
    ? editedMessage.conversation
    : typeof extended?.text === "string" ? extended.text
      : typeof image?.caption === "string" ? image.caption
        : typeof video?.caption === "string" ? video.caption
          : typeof document?.caption === "string" ? document.caption
            : rich?.content ?? null;
  if (text === null) return;

  const { db } = await import("../db");
  const { whatsappMessages } = await import("../../shared/schema");
  const { eq } = await import("drizzle-orm");
  const type = rich?.type
    ?? (image ? "image" : video ? "video" : document ? "document" : "text");
  const caption = image || video || document ? text : null;
  const content = caption === null ? text : null;
  const updated = await db
    .update(whatsappMessages)
    .set({ type, content, caption, editedAt: new Date() })
    .where(eq(whatsappMessages.waMessageId, waMessageId))
    .returning({ id: whatsappMessages.id, conversationId: whatsappMessages.conversationId })
    .catch((err): Array<{ id: string; conversationId: string }> => {
      console.error("[Baileys Events] Erro ao aplicar edição de mensagem:", err);
      return [];
    });
  for (const message of updated) {
    publishConversationEvent(message.conversationId, "message_edited", { messageId: message.id });
  }
}

/** Converte recibos por usuário do Baileys no mesmo fluxo monotônico de status. */
export async function handleMessageReceiptUpdates(data: unknown): Promise<void> {
  const updates = Array.isArray(data) ? data : [data];
  for (const update of updates) {
    const item = update as {
      key?: { id?: string };
      receipt?: { readTimestamp?: unknown; playedTimestamp?: unknown; receiptTimestamp?: unknown };
    };
    const status = item.receipt?.playedTimestamp != null
      ? "played"
      : item.receipt?.readTimestamp != null
        ? "read"
        : item.receipt?.receiptTimestamp != null ? "delivery_ack" : null;
    if (!item.key?.id || !status) continue;
    await handleMessagesUpdate([{ key: item.key, update: { status } }]);
  }
}

/** Presença é efêmera: entrega por SSE aos leitores autorizados, sem persistir. */
export async function handlePresenceUpdate(instanceName: string, data: unknown): Promise<void> {
  const event = data as {
    id?: string;
    presences?: Record<string, { lastKnownPresence?: string; lastSeen?: number }>;
  };
  if (!event.id || isIgnorableJid(event.id) || !event.presences) return;
  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;
  const presences = Object.entries(event.presences)
    .filter(([jid]) => !isIgnorableJid(jid))
    .map(([jid, presence]) => ({
      phone: jidToPhone(jid),
      presence: presence.lastKnownPresence ?? "unavailable",
      lastSeen: presence.lastSeen ?? null,
    }));
  if (presences.length === 0) return;
  const recipients = await getSseTargetUserIds(channel);
  for (const userId of recipients) {
    publishSseEvent("baileys_presence_updated", {
      channelId: channel.id,
      phone: jidToPhone(event.id),
      presences,
    }, userId);
  }
}

/** Histórico chega limitado pelo gateway e reutiliza o handler idempotente de upsert. */
export async function handleMessagingHistory(instanceName: string, data: unknown): Promise<void> {
  const event = data as { messages?: unknown[] };
  if (!Array.isArray(event.messages)) return;
  for (const message of event.messages) await handleMessagesUpsert(instanceName, message);
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
      update?: { status?: string; messageStubParameters?: unknown; message?: Record<string, unknown>; editedMessage?: Record<string, unknown>; pollUpdates?: unknown };
    };
    const { db } = await import("../db");
    const { whatsappMessages } = await import("../../shared/schema");
    const { and, eq, ne, sql } = await import("drizzle-orm");
    const waMessageId = u.key?.id;
    const edited = u.update?.editedMessage ?? u.update?.message;
    if (waMessageId && edited) await handleMessageEdit(waMessageId, edited);
    if (waMessageId && u.update?.pollUpdates !== undefined) {
      const updatedPoll = await db
        .update(whatsappMessages)
        .set({ providerMetadata: sql`COALESCE(${whatsappMessages.providerMetadata}, '{}'::jsonb) || jsonb_build_object('pollUpdates', ${JSON.stringify(u.update.pollUpdates)}::jsonb)` })
        .where(eq(whatsappMessages.waMessageId, waMessageId))
        .returning({ conversationId: whatsappMessages.conversationId });
      for (const poll of updatedPoll) publishConversationEvent(poll.conversationId, "message_edited", { waMessageId });
    }
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
