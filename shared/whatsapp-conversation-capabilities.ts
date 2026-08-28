import { getWhatsappMediaType, type WhatsappMediaType } from "./whatsapp-media";
import { WHATSAPP_MESSAGE_TYPES, type WhatsappMessageType } from "./whatsapp-incoming-message";

export type WhatsappConversationProvider = "cloud_api" | "evolution";

export type WhatsappMessageTypeCapabilities = Record<WhatsappMessageType, boolean>;

export interface WhatsappConversationCapabilities {
  reply: boolean;
  reaction: boolean;
  sticker: boolean;
  forward: boolean;
  deviceEcho: boolean;
  remoteRead: boolean;
  presence: boolean;
  edit: boolean;
  delete: boolean;
  historySync: boolean;
  ptt: boolean;
  messageReceipts: boolean;
  send: WhatsappMessageTypeCapabilities;
  receive: WhatsappMessageTypeCapabilities;
  provider: WhatsappConversationProvider;
  unavailableReason: string | null;
}

interface CapabilityContext {
  provider: WhatsappConversationProvider;
  configured: boolean;
  connected: boolean;
  deviceEchoEnabled?: boolean;
  gatewayFeatures?: Partial<{
    location: boolean; contacts: boolean; polls: boolean; remoteRead: boolean;
    presence: boolean; historySync: boolean; messageDelete: boolean; ptt: boolean; messageReceipts: boolean;
  }>;
}

export interface WhatsappStickerMetadata {
  animated: boolean;
  width: number;
  height: number;
}

interface ProviderFeatures extends Pick<
  WhatsappConversationCapabilities,
  "reply" | "reaction" | "sticker" | "forward" | "remoteRead" | "presence" | "edit" | "delete" | "historySync" | "ptt" | "messageReceipts" | "send" | "receive"
> {}

function messageTypeCapabilities(
  supported: readonly WhatsappMessageType[],
): WhatsappMessageTypeCapabilities {
  return Object.fromEntries(
    WHATSAPP_MESSAGE_TYPES.map((type) => [type, supported.includes(type)]),
  ) as WhatsappMessageTypeCapabilities;
}

const CLOUD_API_SEND_TYPES: readonly WhatsappMessageType[] = [
  "text", "image", "video", "audio", "document", "sticker", "location", "contacts", "template",
];
const CLOUD_API_RECEIVE_TYPES: readonly WhatsappMessageType[] = [
  "text", "image", "video", "audio", "document", "sticker", "location", "contacts", "interactive", "template", "unsupported", "system",
];
const BAILEYS_SEND_TYPES: readonly WhatsappMessageType[] = [
  "text", "image", "video", "audio", "document", "sticker", "location", "contacts", "poll",
];
const BAILEYS_RECEIVE_TYPES: readonly WhatsappMessageType[] = [
  "text", "image", "video", "audio", "document", "sticker", "location", "contacts", "poll", "interactive", "template", "deleted", "unsupported", "system",
];

const PROVIDER_FEATURES: Record<WhatsappConversationProvider, ProviderFeatures> = {
  cloud_api: {
    reply: true, reaction: true, sticker: true, forward: true,
    remoteRead: true, presence: false, edit: false, delete: false, historySync: false,
    ptt: false, messageReceipts: true,
    send: messageTypeCapabilities(CLOUD_API_SEND_TYPES),
    receive: messageTypeCapabilities(CLOUD_API_RECEIVE_TYPES),
  },
  evolution: {
    reply: true, reaction: true, sticker: true, forward: true,
    remoteRead: true, presence: true, edit: false, delete: false, historySync: true,
    ptt: true, messageReceipts: true,
    send: messageTypeCapabilities(BAILEYS_SEND_TYPES),
    receive: messageTypeCapabilities(BAILEYS_RECEIVE_TYPES),
  },
};

export function getWhatsappConversationCapabilities(
  context: CapabilityContext,
): WhatsappConversationCapabilities {
  const unavailableReason = !context.configured
    ? "Canal sem configuração de envio"
    : !context.connected
      ? "Canal desconectado"
      : null;
  const available = unavailableReason === null;
  const baseProviderFeatures = PROVIDER_FEATURES[context.provider];
  const negotiated = context.provider === "evolution" ? context.gatewayFeatures : undefined;
  const sendTypes = context.provider === "evolution"
    ? BAILEYS_SEND_TYPES.filter((type) =>
        type === "location" ? negotiated?.location === true
          : type === "contacts" ? negotiated?.contacts === true
            : type === "poll" ? negotiated?.polls === true
              : true)
    : CLOUD_API_SEND_TYPES;
  const providerFeatures: ProviderFeatures = context.provider === "evolution" ? {
    ...baseProviderFeatures,
    remoteRead: negotiated?.remoteRead === true,
    presence: negotiated?.presence === true,
    historySync: negotiated?.historySync === true,
    ptt: negotiated?.ptt === true,
    messageReceipts: negotiated?.messageReceipts === true,
    delete: negotiated?.messageDelete === true,
    send: messageTypeCapabilities(sendTypes),
  } : baseProviderFeatures;
  const unavailableMessageTypes = messageTypeCapabilities([]);

  return {
    reply: available && providerFeatures.reply,
    reaction: available && providerFeatures.reaction,
    sticker: available && providerFeatures.sticker,
    forward: available && providerFeatures.forward,
    deviceEcho:
      available &&
      (context.provider === "evolution" || context.deviceEchoEnabled === true),
    remoteRead: available && providerFeatures.remoteRead,
    presence: available && providerFeatures.presence,
    edit: available && providerFeatures.edit,
    delete: available && providerFeatures.delete,
    historySync: available && providerFeatures.historySync,
    ptt: available && providerFeatures.ptt,
    messageReceipts: available && providerFeatures.messageReceipts,
    send: available ? providerFeatures.send : unavailableMessageTypes,
    receive: available ? providerFeatures.receive : unavailableMessageTypes,
    provider: context.provider,
    unavailableReason,
  };
}

const APP_MEDIA_LIMIT_BYTES = 16 * 1024 * 1024;
const STICKER_LIMIT_BYTES_BY_PROVIDER: Record<WhatsappConversationProvider, number> = {
  cloud_api: 500 * 1024,
  evolution: 1024 * 1024,
};

export function validateWhatsappMediaForProvider(input: {
  provider: WhatsappConversationProvider;
  mimeType: string;
  size: number;
  sticker?: WhatsappStickerMetadata;
}): { supported: boolean; mediaType: WhatsappMediaType | null; reason: string | null } {
  const mediaType = getWhatsappMediaType(input.mimeType) ?? null;
  if (!mediaType) {
    return {
      supported: false,
      mediaType: null,
      reason: `Tipo de arquivo não suportado: ${input.mimeType}`,
    };
  }

  if (mediaType === "sticker" && !input.sticker) {
    return {
      supported: false,
      mediaType,
      reason: "Não foi possível validar a figurinha WebP",
    };
  }

  if (
    mediaType === "sticker" &&
    input.sticker &&
    (input.sticker.width !== 512 || input.sticker.height !== 512)
  ) {
    return {
      supported: false,
      mediaType,
      reason: "Figurinhas devem ter exatamente 512 × 512 pixels",
    };
  }

  const stickerLimitBytes = input.provider === "cloud_api" && input.sticker?.animated === false
    ? 100 * 1024
    : STICKER_LIMIT_BYTES_BY_PROVIDER[input.provider];
  if (mediaType === "sticker" && input.size > stickerLimitBytes) {
    return {
      supported: false,
      mediaType,
      reason: `Figurinhas devem ter no máximo ${stickerLimitBytes / 1024} KB`,
    };
  }

  const providerLimit = input.provider === "cloud_api"
    ? mediaType === "image"
      ? 5 * 1024 * 1024
      : mediaType === "video" || mediaType === "audio"
        ? 16 * 1024 * 1024
        : mediaType === "document"
          ? 100 * 1024 * 1024
          : APP_MEDIA_LIMIT_BYTES
    : APP_MEDIA_LIMIT_BYTES;
  if (input.size > providerLimit) {
    return {
      supported: false,
      mediaType,
      reason: `Arquivos ${mediaType === "document" && input.provider === "cloud_api" ? "de documento " : ""}devem ter no máximo ${Math.round(providerLimit / (1024 * 1024))} MB`,
    };
  }

  return { supported: true, mediaType, reason: null };
}
