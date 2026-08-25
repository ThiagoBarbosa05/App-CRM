export interface WhatsappFlattenedReply {
  quotedContent: string;
  content: string;
}

export interface WhatsappReplyPresentationInput {
  content: string | null;
  direction: "inbound" | "outbound";
  replyToMessageId: string | null;
  replyToContent: string | null;
  replyToType: string | null;
  replyToDirection: "inbound" | "outbound" | null;
}

export interface WhatsappReplyPresentation {
  content: string | null;
  replyToMessageId: string | null;
  replyToContent: string | null;
  replyToType: string | null;
  replyToDirection: "inbound" | "outbound" | null;
  isReply: boolean;
}

const FLATTENED_REPLY_PATTERN = /^_Em resposta (?:a|à): ([\s\S]+)_:\r?\n\r?\n([\s\S]+)$/;

export function parseWhatsappFlattenedReply(
  value: string | null | undefined,
): WhatsappFlattenedReply | null {
  if (!value) return null;

  const match = FLATTENED_REPLY_PATTERN.exec(value);
  if (!match) return null;

  const quotedContent = match[1].trim();
  const content = match[2].trim();
  if (!quotedContent || !content) return null;

  return { quotedContent, content };
}

export function normalizeWhatsappReplyPresentation(
  input: WhatsappReplyPresentationInput,
): WhatsappReplyPresentation {
  const flattenedReply = input.replyToContent == null
    ? parseWhatsappFlattenedReply(input.content)
    : null;

  if (!flattenedReply) {
    return {
      content: input.content,
      replyToMessageId: input.replyToMessageId,
      replyToContent: input.replyToContent,
      replyToType: input.replyToType,
      replyToDirection: input.replyToDirection,
      isReply: input.replyToMessageId != null || input.replyToContent != null,
    };
  }

  return {
    content: flattenedReply.content,
    replyToMessageId: input.replyToMessageId,
    replyToContent: flattenedReply.quotedContent,
    replyToType: "text",
    replyToDirection: input.direction === "outbound" ? "inbound" : "outbound",
    isReply: true,
  };
}
