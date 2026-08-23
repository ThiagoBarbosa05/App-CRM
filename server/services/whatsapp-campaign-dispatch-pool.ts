import type { WhatsappCampaignClaim } from "./whatsapp-campaign-claim.service";

interface PoolDependencies {
  concurrency: number;
  claim(options: { excludedChannelIds: number[] }): Promise<WhatsappCampaignClaim | null>;
  process(campaignId: string, messageIds: string[]): Promise<void>;
}

export async function runClaimedCampaignPool(deps: PoolDependencies): Promise<void> {
  const concurrency = Math.max(1, Math.floor(deps.concurrency));
  const activeChannels = new Set<number>();
  const active = new Set<Promise<void>>();

  const start = (claim: WhatsappCampaignClaim): void => {
    if (claim.channelId !== null) activeChannels.add(claim.channelId);
    let task: Promise<void>;
    task = deps.process(claim.campaignId, claim.messageIds).finally(() => {
      active.delete(task);
      if (claim.channelId !== null) activeChannels.delete(claim.channelId);
    });
    active.add(task);
  };

  while (true) {
    while (active.size < concurrency) {
      const claim = await deps.claim({ excludedChannelIds: Array.from(activeChannels) });
      if (!claim) break;
      start(claim);
    }

    if (active.size === 0) return;
    await Promise.race(active);
  }
}
