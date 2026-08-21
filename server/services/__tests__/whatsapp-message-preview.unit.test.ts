import { describe, expect, it } from "vitest";
import {
  buildTemplateMessageSnapshot,
  describeBotMessagePreview,
  getBotPreviewMessageId,
  setBotPreviewMessageId,
  truncateBotPreview,
} from "../whatsapp-message-preview";

describe("buildTemplateMessageSnapshot", () => {
  it("renders the body with the values actually sent to positional variables", () => {
    const snapshot = buildTemplateMessageSnapshot({
      templateName: "boas_vindas",
      language: "pt_BR",
      campaign: { id: "campaign-1", name: "Boas-vindas" },
      templateComponents: [
        { type: "BODY", text: "Olá {{1}}, seu pedido {{2}} está pronto." },
      ],
      sentComponents: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Ana" },
            { type: "text", text: "#123" },
          ],
        },
      ],
    });

    expect(snapshot).toEqual({
      content: "Olá Ana, seu pedido #123 está pronto.",
      rawPayload: {
        kind: "campaign_template",
        templateName: "boas_vindas",
        language: "pt_BR",
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana" },
              { type: "text", text: "#123" },
            ],
          },
        ],
        buttons: [],
        campaignId: "campaign-1",
        campaignName: "Boas-vindas",
      },
    });
  });

  it("keeps named variables, header media and template buttons in the snapshot", () => {
    const snapshot = buildTemplateMessageSnapshot({
      templateName: "entrega",
      language: "pt_BR",
      templateComponents: [
        { type: "BODY", text: "Oi {{nome}}, acompanhe sua entrega." },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Confirmar" },
            { type: "URL", text: "Acompanhar", url: "https://example.com/{{1}}" },
          ],
        },
      ],
      sentComponents: [
        {
          type: "header",
          parameters: [
            { type: "image", image: { link: "https://cdn.example.com/header.jpg" } },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "nome", text: "Bruno" },
          ],
        },
      ],
    });

    expect(snapshot.content).toBe("Oi Bruno, acompanhe sua entrega.");
    expect(snapshot.rawPayload.components[0]).toEqual({
      type: "header",
      parameters: [
        { type: "image", image: { link: "https://cdn.example.com/header.jpg" } },
      ],
    });
    expect(snapshot.rawPayload.buttons).toEqual([
      { type: "QUICK_REPLY", text: "Confirmar" },
      { type: "URL", text: "Acompanhar" },
    ]);
  });

  it("maps named placeholders by order when the sender enriched only its internal copy", () => {
    const snapshot = buildTemplateMessageSnapshot({
      templateName: "saudacao_nomeada",
      language: "pt_BR",
      templateComponents: [
        { type: "BODY", text: "Olá {{nome}}, pedido {{pedido}}." },
      ],
      sentComponents: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Carla" },
            { type: "text", text: "#987" },
          ],
        },
      ],
    });

    expect(snapshot.content).toBe("Olá Carla, pedido #987.");
  });

  it("falls back to the template name when Meta does not provide a body", () => {
    const snapshot = buildTemplateMessageSnapshot({
      templateName: "sem_corpo",
      language: "pt_BR",
      templateComponents: [],
      sentComponents: [],
    });

    expect(snapshot.content).toBe("Template: sem_corpo");
  });
});

describe("truncateBotPreview", () => {
  it("keeps short messages and truncates long messages without splitting words", () => {
    expect(truncateBotPreview("Olá, como posso ajudar?", 30)).toBe(
      "Olá, como posso ajudar?",
    );
    expect(truncateBotPreview("Esta mensagem possui muitas palavras para o cartão", 30)).toBe(
      "Esta mensagem possui muitas…",
    );
  });

  it("returns null when the first bot step did not persist visible content", () => {
    expect(truncateBotPreview(null)).toBeNull();
    expect(truncateBotPreview("   ")).toBeNull();
  });
});

describe("describeBotMessagePreview", () => {
  it("uses the visible text sent by the first bot message", () => {
    expect(
      describeBotMessagePreview({ type: "text", content: "Olá, Ana!" }),
    ).toBe("Olá, Ana!");
    expect(
      describeBotMessagePreview({ type: "image", caption: "Confira o catálogo" }),
    ).toBe("Confira o catálogo");
  });

  it("describes media without a caption and ignores invisible steps", () => {
    expect(describeBotMessagePreview({ type: "image" })).toBe("Imagem enviada");
    expect(describeBotMessagePreview({ type: "document" })).toBe("Documento enviado");
    expect(describeBotMessagePreview({ type: "system" })).toBeNull();
  });
});

describe("bot preview marker reference", () => {
  it("survives session-data persistence so delayed bot messages can find the card", () => {
    const variables = setBotPreviewMessageId({ nome: "Ana" }, "message-1");

    expect(variables).toEqual({
      nome: "Ana",
      __crmBotPreviewMessageId: "message-1",
    });
    expect(getBotPreviewMessageId(JSON.parse(JSON.stringify(variables)))).toBe(
      "message-1",
    );
  });
});
