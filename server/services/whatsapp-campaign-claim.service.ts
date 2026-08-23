import { sql, type SQL } from "drizzle-orm";

interface SqlExecutor {
  execute(query: SQL): Promise<unknown>;
}

interface ClaimRow {
  campaign_id: string;
  channel_id: number | null;
  message_id: string;
}

export interface WhatsappCampaignClaim {
  campaignId: string;
  channelId: number | null;
  messageIds: string[];
}

function rowsFrom(result: unknown): Record<string, unknown>[] {
  if (!result || typeof result !== "object" || !("rows" in result)) return [];
  const rows = (result as { rows: unknown }).rows;
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

function parseClaimRow(row: Record<string, unknown>): ClaimRow | null {
  if (typeof row.campaign_id !== "string" || typeof row.message_id !== "string") return null;
  const channelId = row.channel_id === null ? null : Number(row.channel_id);
  if (channelId !== null && !Number.isInteger(channelId)) return null;
  return { campaign_id: row.campaign_id, channel_id: channelId, message_id: row.message_id };
}

export async function claimNextWhatsappCampaignBatch(
  executor: SqlExecutor,
  options: { limit: number; excludedChannelIds?: number[] },
): Promise<WhatsappCampaignClaim | null> {
  const limit = Math.max(1, Math.floor(options.limit));
  const excluded = options.excludedChannelIds ?? [];
  const channelFilter = excluded.length > 0
    ? sql`AND (c.wa_channel_id IS NULL OR c.wa_channel_id NOT IN (${sql.join(excluded.map((id) => sql`${id}`), sql`, `)}))`
    : sql``;

  const result = await executor.execute(sql`
    WITH next_campaign AS (
      SELECT wm.campaign_id
      FROM whatsapp_campaign_messages wm
      INNER JOIN whatsapp_campaigns wc ON wc.id = wm.campaign_id
      INNER JOIN campaigns c ON c.id = wm.campaign_id
      WHERE wc.status = 'in_progress'
        AND wc.cancel_requested_at IS NULL
        AND wm.status = 'scheduled'
        AND (wm.next_attempt_at IS NULL OR wm.next_attempt_at <= now())
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_campaign_messages in_flight
          WHERE in_flight.campaign_id = wm.campaign_id
            AND in_flight.status = 'sending'
        )
        ${channelFilter}
        AND pg_try_advisory_xact_lock(hashtext('wa-campaign:' || wm.campaign_id))
      ORDER BY COALESCE(wm.next_attempt_at, wm.scheduled_at), wm.created_at, wm.id
      FOR UPDATE OF wm SKIP LOCKED
      LIMIT 1
    ), claimed_ids AS (
      SELECT wm.id
      FROM whatsapp_campaign_messages wm
      INNER JOIN next_campaign nc ON nc.campaign_id = wm.campaign_id
      WHERE wm.status = 'scheduled'
        AND (wm.next_attempt_at IS NULL OR wm.next_attempt_at <= now())
      ORDER BY COALESCE(wm.next_attempt_at, wm.scheduled_at), wm.created_at, wm.id
      FOR UPDATE OF wm SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE whatsapp_campaign_messages wm
    SET status = 'sending', updated_at = now()
    FROM claimed_ids ci, campaigns c
    WHERE wm.id = ci.id AND c.id = wm.campaign_id
    RETURNING wm.campaign_id, c.wa_channel_id AS channel_id, wm.id AS message_id
  `);

  const claimed = rowsFrom(result).map(parseClaimRow).filter((row): row is ClaimRow => row !== null);
  if (claimed.length === 0) return null;
  return {
    campaignId: claimed[0].campaign_id,
    channelId: claimed[0].channel_id,
    messageIds: claimed.map((row) => row.message_id),
  };
}

export async function recoverExpiredWhatsappCampaignClaims(
  executor: SqlExecutor,
  options: { leaseTimeoutMs: number },
): Promise<{ rescheduled: number; cancelled: number }> {
  const leaseTimeoutMs = Math.max(1, Math.floor(options.leaseTimeoutMs));
  const rescheduledResult = await executor.execute(sql`
    UPDATE whatsapp_campaign_messages wm
    SET status = 'scheduled', updated_at = now()
    FROM whatsapp_campaigns wc
    WHERE wc.id = wm.campaign_id
      AND wm.status = 'sending'
      AND wm.updated_at < now() - (${leaseTimeoutMs} * interval '1 millisecond')
      AND wc.status = 'in_progress'
      AND wc.cancel_requested_at IS NULL
    RETURNING wm.id AS message_id
  `);
  const cancelledResult = await executor.execute(sql`
    WITH cancelled_messages AS (
      UPDATE whatsapp_campaign_messages wm
      SET status = 'cancelled', updated_at = now()
      FROM whatsapp_campaigns wc
      WHERE wc.id = wm.campaign_id
        AND wm.status = 'sending'
        AND wm.updated_at < now() - (${leaseTimeoutMs} * interval '1 millisecond')
        AND wc.cancel_requested_at IS NOT NULL
      RETURNING wm.id, wm.campaign_id
    ), cancelled_impacts AS (
      UPDATE whatsapp_campaign_impacts wi
      SET status = 'cancelled', updated_at = now()
      FROM cancelled_messages cm
      WHERE wi.campaign_message_id = cm.id
      RETURNING wi.campaign_message_id
    ), finished_campaigns AS (
      UPDATE whatsapp_campaigns wc
      SET status = 'cancelled', completed_at = now(), updated_at = now()
      WHERE wc.cancel_requested_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cancelled_messages cm WHERE cm.campaign_id = wc.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_campaign_messages wm
          WHERE wm.campaign_id = wc.id AND wm.status = 'sending'
        )
      RETURNING wc.id
    )
    SELECT id AS message_id FROM cancelled_messages
  `);
  return {
    rescheduled: rowsFrom(rescheduledResult).length,
    cancelled: rowsFrom(cancelledResult).length,
  };
}

export async function releaseWhatsappCampaignClaim(
  executor: SqlExecutor,
  messageIds: string[],
): Promise<number> {
  if (messageIds.length === 0) return 0;
  const result = await executor.execute(sql`
    UPDATE whatsapp_campaign_messages
    SET status = 'scheduled', updated_at = now()
    WHERE status = 'sending'
      AND id IN (${sql.join(messageIds.map((id) => sql`${id}`), sql`, `)})
    RETURNING id AS message_id
  `);
  return rowsFrom(result).length;
}
