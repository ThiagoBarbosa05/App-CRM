import { count, eq } from "drizzle-orm";
import {
  campaigns,
  whatsappCampaignMessages,
  whatsappCampaigns,
  type Client,
} from "@shared/schema";
import { normalizePhoneE164 } from "@shared/phone";
import { CAMPAIGN_SUPPRESSION_REASONS } from "@shared/whatsapp-campaign-reasons";
import { db } from "../db";
import {
  resolveCampaignAudience,
  type CampaignAudienceSelector,
} from "./whatsapp-campaign-audience.service";
import {
  buildCampaignContentSnapshot,
  fingerprintForClient,
  reserveCampaignMessage,
  type CampaignDedupeConflict,
} from "./whatsapp-campaign-dedupe.service";
import { waError } from "./whatsapp-errors";
import { ensureLocalTemplateForMeta } from "./whatsapp-templates.service";

export type CreateAtomicWhatsappCampaignInput = {
  name: string;
  description?: string;
  waTemplateId?: string;
  waBotId?: string;
  waChannelId: number;
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
  metaTemplateCategory?: string;
  metaTemplateBodyParams?: string[];
  metaTemplateHeaderParams?: string[];
  metaTemplateHeaderMedia?: {
    storageKey: string;
    mediaType: "image" | "video" | "document";
  };
  audience: CampaignAudienceSelector;
  scheduledAt?: string;
  dedupeWindowHours: number;
  postSendWhatsappTagId?: string | null;
  createdBy: string;
};

export type CreateAtomicWhatsappCampaignResult = {
  campaignId: string;
  status: "created" | "in_progress";
  queued: number;
  selected: number;
  eligible: number;
  suppressedDuplicate: number;
  skippedNoPhone: number;
  skippedDuplicatePhone: number;
  skippedOptedOut: number;
  skippedAlreadyQueued: number;
  conflicts: Array<Omit<CampaignDedupeConflict, "scheduledFor"> & { scheduledFor: string }>;
  scheduledAt: string | null;
};

export async function createAtomicWhatsappCampaign(
  input: CreateAtomicWhatsappCampaignInput,
): Promise<CreateAtomicWhatsappCampaignResult> {
  return db.transaction(async (tx) => {
    let templateId = input.waTemplateId ?? null;
    if (!templateId && input.metaTemplateName) {
      const template = await ensureLocalTemplateForMeta(tx, {
        name: input.metaTemplateName,
        languageCode: input.metaTemplateLanguage || "pt_BR",
        category: input.metaTemplateCategory,
        bodyParams: input.metaTemplateBodyParams,
        createdBy: input.createdBy,
      });
      templateId = template.id;
    }

    const [campaign] = await tx
      .insert(campaigns)
      .values({
        name: input.name,
        description: input.description,
        type: "humano",
        waEnabled: true,
        waTemplateId: templateId,
        waBotId: input.waBotId ?? null,
        waChannelId: input.waChannelId,
        metaTemplateBodyParams: input.metaTemplateBodyParams ?? null,
        metaTemplateHeaderParams: input.metaTemplateHeaderParams ?? null,
        metaTemplateHeaderMediaStorageKey: input.metaTemplateHeaderMedia?.storageKey ?? null,
        metaTemplateHeaderMediaType: input.metaTemplateHeaderMedia?.mediaType ?? null,
        createdBy: input.createdBy,
      })
      .returning();

    const clientRows = await resolveCampaignAudience(tx, input.audience);
    const scheduledDate = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const now = new Date();
    const scheduledFor = scheduledDate ?? now;
    const isScheduled = Boolean(scheduledDate && scheduledDate.getTime() > now.getTime());
    const initialStatus = isScheduled ? "created" as const : "in_progress" as const;
    const seenPhones = new Set<string>();
    const validClients: Array<{ client: Client; phoneE164: string }> = [];
    const suppressedMessages: Array<typeof whatsappCampaignMessages.$inferInsert> = [];
    let skippedNoPhone = 0;
    let skippedDuplicatePhone = 0;
    let skippedOptedOut = 0;

    for (const client of clientRows) {
      let suppressionReason: string | null = null;
      let phoneNumber = client.phone ?? "sem telefone";
      if (client.whatsappOptOut) {
        skippedOptedOut++;
        suppressionReason = CAMPAIGN_SUPPRESSION_REASONS.optedOut;
      } else {
        const phoneE164 = client.phone?.trim() ? normalizePhoneE164(client.phone) : null;
        if (!phoneE164) {
          skippedNoPhone++;
          suppressionReason = CAMPAIGN_SUPPRESSION_REASONS.invalidPhone;
        } else if (seenPhones.has(phoneE164)) {
          skippedDuplicatePhone++;
          suppressionReason = CAMPAIGN_SUPPRESSION_REASONS.duplicatePhoneInAudience;
          phoneNumber = phoneE164;
        } else {
          seenPhones.add(phoneE164);
          validClients.push({ client, phoneE164 });
        }
      }
      if (suppressionReason) {
        suppressedMessages.push({
          id: `${campaign.id}-${client.id}`,
          campaignId: campaign.id,
          contactId: client.id,
          contactName: client.name,
          phoneNumber,
          status: "suppressed",
          scheduledAt: scheduledFor,
          suppressionReason,
        });
      }
    }

    if (validClients.length === 0) {
      throw waError(
        skippedOptedOut > 0 && skippedNoPhone === 0
          ? "AUDIENCE_EMPTY_ALL_OPTED_OUT"
          : "AUDIENCE_EMPTY_NO_VALID_PHONE",
      );
    }

    const contentSnapshot = await buildCampaignContentSnapshot(tx, campaign);
    await tx.insert(whatsappCampaigns).values({
      id: campaign.id,
      title: campaign.name,
      status: initialStatus,
      totalContacts: clientRows.length,
      scheduledMessages: validClients.length,
      startDate: scheduledFor,
      botId: campaign.waBotId ?? campaign.waTemplateId ?? "",
      botTriggerName: "whatsapp",
      channelId: "whatsapp",
      fromPhone: "",
      intervalSeconds: 1,
      exclusiveTagFilter: false,
      tagIds: [],
      organizationId: "",
      audienceSelector: input.audience,
      dedupeWindowHours: input.dedupeWindowHours,
      postSendWhatsappTagId: input.postSendWhatsappTagId ?? null,
      contentFingerprintSnapshot: contentSnapshot,
      createdBy: input.createdBy,
    });

    if (suppressedMessages.length > 0) {
      await tx.insert(whatsappCampaignMessages).values(suppressedMessages).onConflictDoNothing();
    }

    let queued = 0;
    let suppressedDuplicate = 0;
    let skippedAlreadyQueued = 0;
    const conflicts: CreateAtomicWhatsappCampaignResult["conflicts"] = [];
    validClients.sort((left, right) => left.phoneE164.localeCompare(right.phoneE164));
    for (const { client, phoneE164 } of validClients) {
      const result = await reserveCampaignMessage(tx, {
        campaignId: campaign.id,
        client,
        phoneNormalized: phoneE164,
        contentFingerprint: fingerprintForClient(contentSnapshot, client, phoneE164),
        scheduledFor,
        windowHours: input.dedupeWindowHours,
        postSendTagRequested: Boolean(input.postSendWhatsappTagId),
      });
      if (result.queued) queued++;
      else if (result.alreadyExisted) skippedAlreadyQueued++;
      else {
        suppressedDuplicate++;
        if (result.conflict && conflicts.length < 10) {
          conflicts.push({
            ...result.conflict,
            scheduledFor: result.conflict.scheduledFor.toISOString(),
          });
        }
      }
    }

    const response: CreateAtomicWhatsappCampaignResult = {
      campaignId: campaign.id,
      status: initialStatus,
      queued,
      selected: clientRows.length,
      eligible: queued,
      suppressedDuplicate,
      skippedNoPhone,
      skippedDuplicatePhone,
      skippedOptedOut,
      skippedAlreadyQueued,
      conflicts,
      scheduledAt: isScheduled ? scheduledDate?.toISOString() ?? null : null,
    };

    if (queued === 0) {
      throw waError("CAMPAIGN_ALL_DUPLICATE", { details: response });
    }

    const statusCounts = await tx
      .select({ status: whatsappCampaignMessages.status, count: count() })
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.campaignId, campaign.id))
      .groupBy(whatsappCampaignMessages.status);
    const countByStatus = Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count)]));
    const totalContacts = statusCounts.reduce((sum, row) => sum + Number(row.count), 0);
    await tx
      .update(whatsappCampaigns)
      .set({
        totalContacts,
        scheduledMessages: countByStatus.scheduled ?? 0,
        sentMessages:
          (countByStatus.sent ?? 0) +
          (countByStatus.delivered ?? 0) +
          (countByStatus.read ?? 0),
        failedMessages: countByStatus.failed ?? 0,
        status: initialStatus,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaign.id));

    return response;
  });
}
