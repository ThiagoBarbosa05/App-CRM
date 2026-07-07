import { db } from "server/db";
import {
  whatsappCampaignMessages,
  emailCampaignRecipients,
  smsCampaignMessages,
} from "@shared/schema";
import { and, count, gte, inArray } from "drizzle-orm";

const WHATSAPP_SENT_STATUSES = ["sent", "delivered", "read"] as const;

export interface ChannelSummary {
  sent: number;
  failed: number;
  pending: number;
}

export interface MarketingSummary {
  whatsapp: ChannelSummary;
  email: ChannelSummary;
  sms: ChannelSummary;
}

/** Contadores dos últimos 30 dias, por canal, para os cards do topo da página Marketing. */
export async function getMarketingSummary(): Promise<MarketingSummary> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [waSent] = await db
    .select({ value: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        inArray(whatsappCampaignMessages.status, [...WHATSAPP_SENT_STATUSES]),
        gte(whatsappCampaignMessages.createdAt, since),
      ),
    );
  const [waFailed] = await db
    .select({ value: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        inArray(whatsappCampaignMessages.status, ["failed", "cancelled"]),
        gte(whatsappCampaignMessages.createdAt, since),
      ),
    );
  const [waPending] = await db
    .select({ value: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        inArray(whatsappCampaignMessages.status, ["scheduled"]),
        gte(whatsappCampaignMessages.createdAt, since),
      ),
    );

  const [emailSent] = await db
    .select({ value: count() })
    .from(emailCampaignRecipients)
    .where(and(inArray(emailCampaignRecipients.status, ["sent"]), gte(emailCampaignRecipients.createdAt, since)));
  const [emailFailed] = await db
    .select({ value: count() })
    .from(emailCampaignRecipients)
    .where(
      and(
        inArray(emailCampaignRecipients.status, ["failed", "bounced"]),
        gte(emailCampaignRecipients.createdAt, since),
      ),
    );
  const [emailPending] = await db
    .select({ value: count() })
    .from(emailCampaignRecipients)
    .where(and(inArray(emailCampaignRecipients.status, ["pending"]), gte(emailCampaignRecipients.createdAt, since)));

  const [smsSent] = await db
    .select({ value: count() })
    .from(smsCampaignMessages)
    .where(and(inArray(smsCampaignMessages.status, ["sent", "delivered"]), gte(smsCampaignMessages.createdAt, since)));
  const [smsFailed] = await db
    .select({ value: count() })
    .from(smsCampaignMessages)
    .where(and(inArray(smsCampaignMessages.status, ["failed"]), gte(smsCampaignMessages.createdAt, since)));
  const [smsPending] = await db
    .select({ value: count() })
    .from(smsCampaignMessages)
    .where(and(inArray(smsCampaignMessages.status, ["pending"]), gte(smsCampaignMessages.createdAt, since)));

  return {
    whatsapp: { sent: Number(waSent.value), failed: Number(waFailed.value), pending: Number(waPending.value) },
    email: { sent: Number(emailSent.value), failed: Number(emailFailed.value), pending: Number(emailPending.value) },
    sms: { sent: Number(smsSent.value), failed: Number(smsFailed.value), pending: Number(smsPending.value) },
  };
}
