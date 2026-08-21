export interface AutomationEventPayload {
  kind?: string;
  botName?: string;
  campaignName?: string;
  preview?: string | null;
}

export interface AutomationEventPreview {
  eyebrow: "Bot iniciado" | "Campanha via bot";
  title: string;
  preview: string | null;
  campaignName: string | null;
}

export function getAutomationEventPreview(
  payload: AutomationEventPayload | null | undefined,
): AutomationEventPreview | null {
  if (payload?.kind !== "bot_started" && payload?.kind !== "campaign_bot") {
    return null;
  }

  return {
    eyebrow:
      payload.kind === "campaign_bot" ? "Campanha via bot" : "Bot iniciado",
    title: payload.botName?.trim() || "Bot",
    preview: payload.preview?.trim() || null,
    campaignName:
      payload.kind === "campaign_bot"
        ? payload.campaignName?.trim() || null
        : null,
  };
}

export function shouldRenderSystemPill(
  messageType: string,
  payload: AutomationEventPayload | null | undefined,
): boolean {
  return messageType === "system" && getAutomationEventPreview(payload) === null;
}
