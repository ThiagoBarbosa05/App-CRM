export type WhatsappMediaType = "image" | "video" | "audio" | "document" | "sticker";

export const WHATSAPP_MEDIA_TYPE_BY_MIME: Record<string, WhatsappMediaType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "sticker",
  "video/mp4": "video",
  "video/3gpp": "video",
  "audio/mpeg": "audio",
  "audio/ogg": "audio",
  "audio/opus": "audio",
  "audio/aac": "audio",
  "audio/mp4": "audio",
  "audio/webm": "audio",
  "application/pdf": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "application/vnd.ms-excel": "document",
  "text/csv": "document",
  "text/plain": "document",
};

export function getWhatsappMediaType(mimeType: string): WhatsappMediaType | undefined {
  return WHATSAPP_MEDIA_TYPE_BY_MIME[mimeType];
}

export function isWhatsappMediaMimeTypeSupported(mimeType: string): boolean {
  return getWhatsappMediaType(mimeType) !== undefined;
}
