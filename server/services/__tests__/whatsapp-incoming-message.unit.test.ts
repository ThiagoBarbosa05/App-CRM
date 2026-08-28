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
      structuredContent: { kind: "unsupported", sourceType: "unsupported" },
    });
  });

  it("preserva localização recebida como conteúdo estruturado", () => {
    expect(normalizeWhatsappIncomingMessage({
      type: "location",
      location: {
        latitude: -23.55052,
        longitude: -46.633308,
        name: "Praça da Sé",
        address: "Sé, São Paulo - SP",
      },
    })).toEqual({
      type: "location",
      media: undefined,
      structuredContent: {
        kind: "location",
        latitude: -23.55052,
        longitude: -46.633308,
        name: "Praça da Sé",
        address: "Sé, São Paulo - SP",
      },
    });
  });

  it("preserva a resposta interativa sem reduzi-la a texto", () => {
    expect(normalizeWhatsappIncomingMessage({
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: "schedule", title: "Agendar visita" },
      },
    })).toEqual({
      type: "interactive",
      media: undefined,
      structuredContent: {
        kind: "interactive",
        interactiveType: "button_reply",
        reply: { id: "schedule", title: "Agendar visita" },
      },
    });
  });

  it.each([
    [{ type: "contacts", contacts: [{ name: { formatted_name: "Ana" } }] }, {
      type: "contacts",
      structuredContent: { kind: "contacts", contacts: [{ name: { formatted_name: "Ana" } }] },
    }],
    [{ type: "poll", poll: { name: "Melhor dia?", options: [{ id: "fri", name: "Sexta" }] } }, {
      type: "poll",
      structuredContent: {
        kind: "poll",
        poll: { name: "Melhor dia?", options: [{ id: "fri", name: "Sexta" }] },
      },
    }],
    [{ type: "template", template: { name: "welcome", language: { code: "pt_BR" } } }, {
      type: "template",
      structuredContent: {
        kind: "template",
        template: { name: "welcome", language: { code: "pt_BR" } },
      },
    }],
    [{ type: "deleted" }, { type: "deleted", structuredContent: { kind: "deleted" } }],
    [{ type: "system" }, { type: "system", structuredContent: { kind: "system", body: undefined } }],
    [{ type: "note" }, { type: "note", structuredContent: { kind: "note", body: undefined } }],
  ])("normaliza conteúdo estruturado para %o", (message, expected) => {
    expect(normalizeWhatsappIncomingMessage(message)).toMatchObject(expected);
  });

  it("converte um tipo desconhecido para unsupported sem perder sua origem", () => {
    expect(normalizeWhatsappIncomingMessage({ type: "order" })).toEqual({
      type: "unsupported",
      media: undefined,
      structuredContent: { kind: "unsupported", sourceType: "order" },
    });
  });
});
