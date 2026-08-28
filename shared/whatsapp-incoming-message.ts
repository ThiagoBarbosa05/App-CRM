export const WHATSAPP_MESSAGE_TYPES = [
  "text", "image", "video", "audio", "document", "sticker", "location", "contacts",
  "poll", "interactive", "template", "deleted", "unsupported", "system", "note",
] as const;

export type WhatsappMessageType = (typeof WHATSAPP_MESSAGE_TYPES)[number];

export type WhatsappDeliveryState =
  | "pending" | "sent" | "delivered" | "read" | "played" | "failed" | "deleted";

export interface WhatsappLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  url?: string;
}

export interface WhatsappContactContent {
  name?: { formatted_name?: string; first_name?: string; last_name?: string };
  phones?: Array<{ phone?: string; wa_id?: string; type?: string }>;
  emails?: Array<{ email?: string; type?: string }>;
  urls?: Array<{ url?: string; type?: string }>;
  [key: string]: unknown;
}

export interface WhatsappPollContent {
  name: string;
  options: Array<{ id?: string; name: string }>;
  selectableOptionsCount?: number;
}

export interface WhatsappInteractiveReplyContent {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsappInteractiveContent {
  type: string;
  button_reply?: WhatsappInteractiveReplyContent;
  list_reply?: WhatsappInteractiveReplyContent;
  nfm_reply?: { response_json: string; name: string; body: string };
}

export interface WhatsappTemplateContent {
  name?: string;
  language?: { code?: string };
  [key: string]: unknown;
}

export type WhatsappStructuredContent =
  | ({ kind: "location" } & WhatsappLocationContent)
  | { kind: "contacts"; contacts: WhatsappContactContent[] }
  | { kind: "poll"; poll: WhatsappPollContent }
  | {
      kind: "interactive";
      interactiveType: string;
      reply?: WhatsappInteractiveReplyContent;
      flowReply?: WhatsappInteractiveContent["nfm_reply"];
    }
  | { kind: "template"; template: WhatsappTemplateContent }
  | { kind: "deleted"; reason?: string }
  | { kind: "unsupported"; sourceType?: string }
  | { kind: "system"; body?: string }
  | { kind: "note"; body?: string };

/**
 * Provider-neutral message attributes. Optional fields are only populated as
 * their storage migration is rolled out, so this contract does not imply new
 * mandatory database columns.
 */
export interface WhatsappMessageContract {
  type: WhatsappMessageType;
  deliveryState?: WhatsappDeliveryState;
  structuredContent?: WhatsappStructuredContent | null;
  providerMetadata?: Record<string, unknown>;
  rawPayload?: unknown;
  editedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface IncomingMediaObject {
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
  location?: WhatsappLocationContent;
  contacts?: WhatsappContactContent[];
  poll?: WhatsappPollContent;
  interactive?: WhatsappInteractiveContent;
  template?: WhatsappTemplateContent;
  text?: { body?: string };
  [key: string]: unknown;
}

export interface NormalizedWhatsappIncomingMessage {
  type: string;
  media: IncomingMediaObject | undefined;
  structuredContent?: WhatsappStructuredContent;
}

function getStructuredContent(
  message: NormalizableWhatsappMessage,
  normalizedType: WhatsappMessageType,
): WhatsappStructuredContent | undefined {
  if (normalizedType === "unsupported") {
    return { kind: "unsupported", sourceType: message.type };
  }
  if (message.location) return { kind: "location", ...message.location };
  if (message.contacts) return { kind: "contacts", contacts: message.contacts };
  if (message.poll) return { kind: "poll", poll: message.poll };
  if (message.interactive) {
    const reply = message.interactive.button_reply ?? message.interactive.list_reply;
    return {
      kind: "interactive",
      interactiveType: message.interactive.type,
      ...(reply ? { reply } : {}),
      ...(message.interactive.nfm_reply ? { flowReply: message.interactive.nfm_reply } : {}),
    };
  }
  if (message.template) return { kind: "template", template: message.template };
  if (message.type === "deleted") return { kind: "deleted" };
  if (message.type === "system") return { kind: "system", body: message.text?.body };
  if (message.type === "note") return { kind: "note", body: message.text?.body };
  return undefined;
}

function isWhatsappMessageType(type: string): type is WhatsappMessageType {
  return (WHATSAPP_MESSAGE_TYPES as readonly string[]).includes(type);
}

export function normalizeWhatsappIncomingMessage(
  message: NormalizableWhatsappMessage,
): NormalizedWhatsappIncomingMessage {
  const media =
    message.sticker ??
    message.image ??
    message.audio ??
    message.video ??
    message.document;

  const type: WhatsappMessageType = message.sticker
    ? "sticker"
    : isWhatsappMessageType(message.type)
      ? message.type
      : "unsupported";
  const structuredContent = getStructuredContent(message, type);
  return {
    // O objeto de mídia é a fonte mais específica. Algumas versões da Cloud
    // API rotulam figurinhas animadas como `unsupported`, mas ainda enviam
    // `sticker`, que permite baixar e exibir o WebP normalmente.
    type,
    media,
    ...(structuredContent ? { structuredContent } : {}),
  };
}
