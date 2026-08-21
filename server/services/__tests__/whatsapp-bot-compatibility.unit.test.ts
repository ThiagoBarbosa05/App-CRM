import { describe, expect, it } from "vitest";
import type { WhatsappBotEdge, WhatsappBotNode } from "@shared/schema";
import {
  analyzeBotFlowCompatibility,
  filterBotsCompatibleWithProvider,
} from "../whatsapp-bot-compatibility.service";

function node(
  id: string,
  type: WhatsappBotNode["type"],
  data: Record<string, unknown> = {},
): WhatsappBotNode {
  return {
    id,
    botId: "bot-1",
    type,
    label: id,
    positionX: 0,
    positionY: 0,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function edge(
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle: string | null = null,
): WhatsappBotEdge {
  return {
    id: `${sourceNodeId}-${targetNodeId}-${sourceHandle ?? "default"}`,
    botId: "bot-1",
    sourceNodeId,
    targetNodeId,
    sourceHandle,
    label: null,
    createdAt: new Date(),
  };
}

describe("analyzeBotFlowCompatibility", () => {
  it("aceita texto e mídia a frio em canal QR Code", () => {
    const issues = analyzeBotFlowCompatibility(
      [
        node("start", "start_manual"),
        node("media", "send_message", {
          messageType: "text",
          text: "Olá",
          attachment: { storageKey: "bot-attachments/image.jpg", type: "image" },
        }),
        node("end", "end"),
      ],
      [edge("start", "media"), edge("media", "end")],
      "evolution",
    );

    expect(issues).toEqual([]);
  });

  it.each(["send_template", "menu", "flow_form"] as const)(
    "bloqueia o nó %s em canal QR Code",
    (type) => {
      const issues = analyzeBotFlowCompatibility(
        [node("start", "start_manual"), node("exclusive", type)],
        [edge("start", "exclusive")],
        "evolution",
      );
      expect(issues).toContainEqual(
        expect.objectContaining({ nodeId: "exclusive", code: "CLOUD_ONLY_NODE" }),
      );
    },
  );

  it("bloqueia texto a frio na Cloud API", () => {
    const issues = analyzeBotFlowCompatibility(
      [
        node("start", "start_manual"),
        node("message", "send_message", { messageType: "text", text: "Olá" }),
      ],
      [edge("start", "message")],
      "cloud_api",
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ nodeId: "message", code: "CLOUD_WINDOW_REQUIRED" }),
    );
  });

  it("permite template seguido de resposta e texto na Cloud API", () => {
    const issues = analyzeBotFlowCompatibility(
      [
        node("start", "start_manual"),
        node("template", "send_template", { metaTemplateName: "abertura" }),
        node("message", "send_message", { messageType: "text", text: "Como posso ajudar?" }),
      ],
      [edge("start", "template"), edge("template", "message", "button-0")],
      "cloud_api",
    );
    expect(issues).toEqual([]);
  });

  it("mantém a janela fechada na saída sem resposta do template", () => {
    const issues = analyzeBotFlowCompatibility(
      [
        node("start", "start_manual"),
        node("template", "send_template", { metaTemplateName: "abertura" }),
        node("message", "send_message", { messageType: "text", text: "Tentativa" }),
      ],
      [edge("start", "template"), edge("template", "message", "no_response")],
      "cloud_api",
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ nodeId: "message", code: "CLOUD_WINDOW_REQUIRED" }),
    );
  });

  it("detecta mais de uma saída comum no mesmo nó", () => {
    const issues = analyzeBotFlowCompatibility(
      [node("start", "start_manual"), node("a", "end"), node("b", "end")],
      [edge("start", "a"), edge("start", "b")],
      "evolution",
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ nodeId: "start", code: "AMBIGUOUS_BRANCH" }),
    );
  });
});

describe("filterBotsCompatibleWithProvider", () => {
  const bots = [
    { id: "plain", name: "Bot simples" },
    { id: "meta", name: "Bot com template" },
  ];
  const nodes = [
    node("plain-start", "start_manual"),
    { ...node("plain-message", "send_message", { messageType: "text" }), botId: "plain" },
    { ...node("meta-start", "start_manual"), botId: "meta" },
    { ...node("meta-template", "send_template"), botId: "meta" },
  ].map((item) => ({
    ...item,
    botId: item.id.startsWith("plain-") ? "plain" : item.botId,
  }));
  const edges = [
    { ...edge("plain-start", "plain-message"), botId: "plain" },
    { ...edge("meta-start", "meta-template"), botId: "meta" },
  ];

  it("oculta no QR Code bots cujo fluxo usa recursos exclusivos da Meta", () => {
    expect(filterBotsCompatibleWithProvider(bots, nodes, edges, "evolution"))
      .toEqual([{ id: "plain", name: "Bot simples" }]);
  });

  it("não filtra bots da listagem em canais Cloud API", () => {
    expect(filterBotsCompatibleWithProvider(bots, nodes, edges, "cloud_api"))
      .toEqual(bots);
  });
});
