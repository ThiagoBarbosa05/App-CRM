import { and, eq, inArray } from "drizzle-orm";

import {
  whatsappCampaignImpacts,
  whatsappCampaignMessages,
  whatsappCampaigns,
} from "@shared/schema";
import { db } from "../db";
import { waError } from "./whatsapp-errors";

type CampaignStatus = typeof whatsappCampaigns.$inferSelect.status;
export type WhatsappCampaignAction = "pause" | "resume" | "cancel";

export interface WhatsappCampaignTransitionResult {
  campaignId: string;
  status: CampaignStatus;
  cancelledMessages?: number;
}

const ALLOWED_SOURCE_STATUSES: Record<WhatsappCampaignAction, readonly CampaignStatus[]> = {
  pause: ["created", "in_progress"],
  resume: ["paused"],
  cancel: ["created", "in_progress", "paused"],
};

const TARGET_STATUS: Record<WhatsappCampaignAction, CampaignStatus> = {
  pause: "paused",
  resume: "in_progress",
  cancel: "cancelled",
};

/**
 * Aplica uma transição manual à campanha sob lock de linha. A leitura, a
 * validação e todas as escritas compartilham a mesma transação para impedir
 * falsos sucessos e cancelamentos parciais sob concorrência.
 */
export async function transitionWhatsappCampaign(
  campaignId: string,
  action: WhatsappCampaignAction,
): Promise<WhatsappCampaignTransitionResult> {
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select({
        id: whatsappCampaigns.id,
        status: whatsappCampaigns.status,
        startDate: whatsappCampaigns.startDate,
      })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, campaignId))
      .for("update");

    if (!campaign) {
      throw waError("CAMPAIGN_NOT_FOUND");
    }

    if (!ALLOWED_SOURCE_STATUSES[action].includes(campaign.status)) {
      throw waError("CAMPAIGN_INVALID_TRANSITION", {
        details: { campaignId, action, currentStatus: campaign.status },
      });
    }

    const now = new Date();
    const targetStatus =
      action === "resume" && campaign.startDate && campaign.startDate > now
        ? "created"
        : TARGET_STATUS[action];

    if (action !== "cancel") {
      const [updated] = await tx
        .update(whatsappCampaigns)
        .set({ status: targetStatus, updatedAt: now })
        .where(eq(whatsappCampaigns.id, campaignId))
        .returning({ id: whatsappCampaigns.id });

      if (!updated) throw waError("CAMPAIGN_NOT_FOUND");
      return { campaignId, status: targetStatus };
    }

    const cancelledMessages = await tx
      .update(whatsappCampaignMessages)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "scheduled"),
        ),
      )
      .returning({ id: whatsappCampaignMessages.id });

    if (cancelledMessages.length > 0) {
      await tx
        .update(whatsappCampaignImpacts)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          inArray(
            whatsappCampaignImpacts.campaignMessageId,
            cancelledMessages.map(({ id }) => id),
          ),
        )
        .returning({ id: whatsappCampaignImpacts.id });
    }

    const [updated] = await tx
      .update(whatsappCampaigns)
      .set({ status: "cancelled", completedAt: now, updatedAt: now })
      .where(eq(whatsappCampaigns.id, campaignId))
      .returning({ id: whatsappCampaigns.id });

    if (!updated) throw waError("CAMPAIGN_NOT_FOUND");
    return {
      campaignId,
      status: "cancelled",
      cancelledMessages: cancelledMessages.length,
    };
  });
}
