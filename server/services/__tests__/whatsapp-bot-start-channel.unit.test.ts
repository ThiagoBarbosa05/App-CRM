import { describe, expect, it } from "vitest";
import { nodeAllowsExternalChannel } from "../whatsapp-bot-engine.service";

describe("nodeAllowsExternalChannel", () => {
  it("aceita somente canais configurados no nó start_channel", () => {
    const node = {
      type: "start_channel",
      data: { channelIds: [3, 9] },
    };

    expect(nodeAllowsExternalChannel(node, 9)).toBe(true);
    expect(nodeAllowsExternalChannel(node, 7)).toBe(false);
  });

  it("não usa nós manuais como origem de disparos externos", () => {
    expect(
      nodeAllowsExternalChannel(
        { type: "start_manual", data: { channelIds: [9] } },
        9,
      ),
    ).toBe(false);
  });

  it("não escolhe canal quando a configuração está vazia", () => {
    expect(
      nodeAllowsExternalChannel(
        { type: "start_channel", data: { channelIds: [] } },
        9,
      ),
    ).toBe(false);
  });
});
