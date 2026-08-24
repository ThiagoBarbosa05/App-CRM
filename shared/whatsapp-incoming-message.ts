interface IncomingMediaObject {
  id: string;
  mime_type: string;
}

export interface NormalizableWhatsappMessage {
  type: string;
  image?: IncomingMediaObject;
  audio?: IncomingMediaObject;
  video?: IncomingMediaObject;
  document?: IncomingMediaObject;
  sticker?: IncomingMediaObject;
}

export function normalizeWhatsappIncomingMessage(message: NormalizableWhatsappMessage): {
  type: string;
  media: IncomingMediaObject | undefined;
} {
  const media =
    message.sticker ??
    message.image ??
    message.audio ??
    message.video ??
    message.document;

  return {
    // O objeto de mídia é a fonte mais específica. Algumas versões da Cloud
    // API rotulam figurinhas animadas como `unsupported`, mas ainda enviam
    // `sticker`, que permite baixar e exibir o WebP normalmente.
    type: message.sticker ? "sticker" : message.type,
    media,
  };
}
