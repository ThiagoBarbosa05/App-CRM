import { describe, expect, it, vi } from "vitest";
import { runClaimedCampaignPool } from "../whatsapp-campaign-dispatch-pool";

describe("pool do dispatcher de campanhas WhatsApp", () => {
  it("processa canais diferentes simultaneamente e nunca reivindica um canal já ativo", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const claims = [
      { campaignId: "campaign-1", channelId: 10, messageIds: ["message-1"] },
      { campaignId: "campaign-2", channelId: 20, messageIds: ["message-2"] },
      null,
    ];
    const claim = vi.fn(async () => claims.shift() ?? null);
    const process = vi.fn(async (campaignId: string) => {
      if (campaignId === "campaign-1") await firstPending;
    });

    const running = runClaimedCampaignPool({ concurrency: 2, claim, process });
    await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(2));

    expect(claim.mock.calls[1][0]).toEqual({ excludedChannelIds: [10] });
    releaseFirst?.();
    await running;
  });
});
