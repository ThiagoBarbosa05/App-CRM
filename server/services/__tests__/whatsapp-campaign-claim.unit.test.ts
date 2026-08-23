import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  claimNextWhatsappCampaignBatch,
  releaseWhatsappCampaignClaim,
  recoverExpiredWhatsappCampaignClaims,
} from "../whatsapp-campaign-claim.service";

describe("claim de mensagens de campanha WhatsApp", () => {
  it("devolve somente o lote reservado atomicamente pelo banco", async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [
        { campaign_id: "campaign-1", channel_id: 7, message_id: "message-1" },
        { campaign_id: "campaign-1", channel_id: 7, message_id: "message-2" },
      ],
    });

    const claim = await claimNextWhatsappCampaignBatch({ execute }, {
      limit: 2,
      excludedChannelIds: [3, 5],
    });

    expect(claim).toEqual({
      campaignId: "campaign-1",
      channelId: 7,
      messageIds: ["message-1", "message-2"],
    });
    expect(execute).toHaveBeenCalledOnce();
    const emittedSql = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(emittedSql).toContain("FOR UPDATE OF wm SKIP LOCKED");
    expect(emittedSql).toContain("SET status = 'sending'");
    expect(emittedSql).toContain("NOT EXISTS");
  });

  it("retorna null quando outro worker já reservou todos os lotes elegíveis", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      claimNextWhatsappCampaignBatch({ execute }, { limit: 25 }),
    ).resolves.toBeNull();
  });

  it("recupera leases expirados usando o limite informado", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ message_id: "message-1" }] })
      .mockResolvedValueOnce({ rows: [{ message_id: "message-2" }] });

    const result = await recoverExpiredWhatsappCampaignClaims(
      { execute },
      { leaseTimeoutMs: 120_000 },
    );

    expect(result).toEqual({ rescheduled: 1, cancelled: 1 });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("libera somente as mensagens ainda sending quando o worker falha", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ message_id: "message-2" }] });

    await expect(
      releaseWhatsappCampaignClaim({ execute }, ["message-1", "message-2"]),
    ).resolves.toBe(1);
  });
});
