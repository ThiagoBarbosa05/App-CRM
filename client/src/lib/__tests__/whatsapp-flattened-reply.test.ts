import { describe, expect, it } from "vitest";
import {
  normalizeWhatsappReplyPresentation,
  parseWhatsappFlattenedReply,
} from "@shared/whatsapp-flattened-reply";

describe("parseWhatsappFlattenedReply", () => {
  it.each([
    [
      "_Em resposta à: De R$ 1.399,90 por R$ 839.9..._:\n\n5 grfs",
      "De R$ 1.399,90 por R$ 839.9...",
      "5 grfs",
    ],
    [
      "_Em resposta a: Mensagem sem acento_:\r\n\r\nResposta via Windows",
      "Mensagem sem acento",
      "Resposta via Windows",
    ],
    [
      "_Em resposta à: Primeira linha\nsegunda linha..._:\n\nResposta\nem duas linhas",
      "Primeira linha\nsegunda linha...",
      "Resposta\nem duas linhas",
    ],
  ])("separa a citação achatada do corpo da resposta", (input, quotedContent, content) => {
    expect(parseWhatsappFlattenedReply(input)).toEqual({
      quotedContent,
      content,
    });
  });

  it.each([
    "Mensagem comum que menciona Em resposta à solicitação",
    "_Em resposta à: sem separador final_",
    "Em resposta à: sem marcadores:\n\nTexto",
    "_Em resposta à: citação_:\n\n",
  ])("não altera texto fora do formato sintético estrito", (input) => {
    expect(parseWhatsappFlattenedReply(input)).toBeNull();
  });
});

describe("normalizeWhatsappReplyPresentation", () => {
  it("enriquece um registro histórico achatado sem inventar vínculo com outra mensagem", () => {
    expect(normalizeWhatsappReplyPresentation({
      content: "_Em resposta à: Oferta original..._:\n\nQuero duas",
      direction: "outbound",
      replyToMessageId: null,
      replyToContent: null,
      replyToType: null,
      replyToDirection: null,
    })).toEqual({
      content: "Quero duas",
      replyToMessageId: null,
      replyToContent: "Oferta original...",
      replyToType: "text",
      replyToDirection: "inbound",
      isReply: true,
    });
  });

  it("preserva respostas nativas e seus metadados", () => {
    expect(normalizeWhatsappReplyPresentation({
      content: "Resposta nativa",
      direction: "inbound",
      replyToMessageId: "message-1",
      replyToContent: "Mensagem original",
      replyToType: "text",
      replyToDirection: "outbound",
    })).toEqual({
      content: "Resposta nativa",
      replyToMessageId: "message-1",
      replyToContent: "Mensagem original",
      replyToType: "text",
      replyToDirection: "outbound",
      isReply: true,
    });
  });
});
