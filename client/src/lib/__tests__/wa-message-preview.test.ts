import { describe, expect, it } from "vitest";
import {
  getAutomationEventPreview,
  shouldRenderSystemPill,
} from "../wa-message-preview";

describe("getAutomationEventPreview", () => {
  it("builds a bot-started card with the first sent message", () => {
    expect(
      getAutomationEventPreview({
        kind: "bot_started",
        botName: "Qualificação",
        preview: "Olá, como posso ajudar?",
      }),
    ).toEqual({
      eyebrow: "Bot iniciado",
      title: "Qualificação",
      preview: "Olá, como posso ajudar?",
      campaignName: null,
    });
  });

  it("identifies bot campaigns and accepts an empty preview", () => {
    expect(
      getAutomationEventPreview({
        kind: "campaign_bot",
        campaignName: "Reativação",
        botName: "Retenção",
        preview: null,
      }),
    ).toEqual({
      eyebrow: "Campanha via bot",
      title: "Retenção",
      preview: null,
      campaignName: "Reativação",
    });
  });

  it("ignores unrelated message payloads", () => {
    expect(getAutomationEventPreview({ kind: "conversation_template" })).toBeNull();
    expect(getAutomationEventPreview(null)).toBeNull();
  });

  it("keeps automation events in the normal bubble renderer instead of the system pill", () => {
    expect(shouldRenderSystemPill("system", { kind: "bot_started" })).toBe(false);
    expect(shouldRenderSystemPill("system", { kind: "campaign_bot" })).toBe(false);
    expect(shouldRenderSystemPill("system", { kind: "conversation_started" })).toBe(true);
    expect(shouldRenderSystemPill("text", null)).toBe(false);
  });
});
