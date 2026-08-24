import { describe, expect, it } from "vitest";
import { normalizeWhatsappIncomingMessage } from "@shared/whatsapp-incoming-message";

describe("normalizeWhatsappIncomingMessage", () => {
  it("mantém uma figurinha recebida como sticker", () => {
    const sticker = { id: "media-1", mime_type: "image/webp" };
    expect(normalizeWhatsappIncomingMessage({ type: "sticker", sticker })).toEqual({
      type: "sticker",
      media: sticker,
    });
  });

  it("normaliza unsupported quando o payload contém a mídia da figurinha", () => {
    const sticker = { id: "media-animated", mime_type: "image/webp" };
    expect(normalizeWhatsappIncomingMessage({ type: "unsupported", sticker })).toEqual({
      type: "sticker",
      media: sticker,
    });
  });

  it("preserva unsupported quando não há mídia recuperável", () => {
    expect(normalizeWhatsappIncomingMessage({ type: "unsupported" })).toEqual({
      type: "unsupported",
      media: undefined,
    });
  });
});
