import { getWhatsappMediaType, type WhatsappMediaType } from "./whatsapp-media";

export type WhatsappConversationProvider = "cloud_api" | "evolution";

export interface WhatsappConversationCapabilities {
  reply: boolean;
  reaction: boolean;
  sticker: boolean;
  forward: boolean;
  deviceEcho: boolean;
  provider: WhatsappConversationProvider;
  unavailableReason: string | null;
}

interface CapabilityContext {
  provider: WhatsappConversationProvider;
  configured: boolean;
  connected: boolean;
  deviceEchoEnabled?: boolean;
}

const PROVIDER_FEATURES: Record<
  WhatsappConversationProvider,
  Pick<WhatsappConversationCapabilities, "reply" | "reaction" | "sticker" | "forward">
> = {
  cloud_api: { reply: true, reaction: true, sticker: true, forward: true },
  evolution: { reply: true, reaction: true, sticker: true, forward: true },
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
  const providerFeatures = PROVIDER_FEATURES[context.provider];

  return {
    reply: available && providerFeatures.reply,
    reaction: available && providerFeatures.reaction,
    sticker: available && providerFeatures.sticker,
    forward: available && providerFeatures.forward,
    deviceEcho:
      available &&
      (context.provider === "evolution" || context.deviceEchoEnabled === true),
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
}): { supported: boolean; mediaType: WhatsappMediaType | null; reason: string | null } {
  const mediaType = getWhatsappMediaType(input.mimeType) ?? null;
  if (!mediaType) {
    return {
      supported: false,
      mediaType: null,
      reason: `Tipo de arquivo não suportado: ${input.mimeType}`,
    };
  }

  const stickerLimitBytes = STICKER_LIMIT_BYTES_BY_PROVIDER[input.provider];
  if (mediaType === "sticker" && input.size > stickerLimitBytes) {
    return {
      supported: false,
      mediaType,
      reason: `Figurinhas devem ter no máximo ${stickerLimitBytes / 1024} KB`,
    };
  }

  if (input.size > APP_MEDIA_LIMIT_BYTES) {
    return {
      supported: false,
      mediaType,
      reason: "Arquivos devem ter no máximo 16 MB",
    };
  }

  return { supported: true, mediaType, reason: null };
}
