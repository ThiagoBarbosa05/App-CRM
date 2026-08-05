import { createHash } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  campaigns,
  clients,
  contactTags,
  whatsappBotEdges,
  whatsappBotNodes,
  whatsappCampaignImpacts,
  whatsappCampaignMessages,
  whatsappTemplates,
  type Campaign,
  type Client,
  type WhatsappBotNode,
} from "@shared/schema";
import { db, type DbExecutor } from "../db";
import {
  buildClientVariables,
  selectCampaignEntryNode,
} from "./whatsapp-bot-engine.service";

export const DEFAULT_DEDUPE_WINDOW_HOURS = 24;
export const MAX_DEDUPE_WINDOW_HOURS = 24 * 365;

type EligibleClient = Pick<Client, "id" | "name" | "phone" | "whatsappOptOut">;

export type CampaignDedupeConflict = {
  campaignId: string;
  campaignMessageId: string;
  scheduledFor: Date;
  phoneMasked: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${"*".repeat(Math.max(4, phone.length - 4))}${phone.slice(-4)}`;
}

function outboundNodePayload(node: WhatsappBotNode): unknown | null {
  const data = node.data as Record<string, unknown>;
  if (node.type === "send_message") {
    return {
      type: node.type,
      messageType: data.messageType,
      text: data.text,
      attachment: data.attachment,
      templateId: data.templateId,
      metaTemplateName: data.metaTemplateName,
      metaTemplateLanguage: data.metaTemplateLanguage,
      templateParams: data.templateParams,
      templateHeaderMedia: data.templateHeaderMedia,
    };
  }
  if (node.type === "send_template") {
    return {
      type: node.type,
      templateId: data.templateId,
      metaTemplateName: data.metaTemplateName,
      metaTemplateLanguage: data.metaTemplateLanguage,
      templateParams: data.templateParams,
      templateHeaderMedia: data.templateHeaderMedia,
      buttonHandles: data.buttonHandles,
    };
  }
  if (node.type === "menu") {
    return {
      type: node.type,
      bodyText: data.bodyText,
      headerText: data.headerText,
      footerText: data.footerText,
      options: data.options,
      renderAs: data.renderAs,
      listButtonText: data.listButtonText,
    };
  }
  return null;
}

async function resolveBotOpening(
  botId: string,
): Promise<unknown> {
  const [nodes, edges] = await Promise.all([
    db.select().from(whatsappBotNodes).where(eq(whatsappBotNodes.botId, botId)),
    db.select().from(whatsappBotEdges).where(eq(whatsappBotEdges.botId, botId)),
  ]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const entryNode = selectCampaignEntryNode(nodes, edges);
  const queue = entryNode ? [entryNode.id] : [];
  const visited = new Set<string>();
  const openings: unknown[] = [];

  while (queue.length > 0 && openings.length < 25) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const payload = outboundNodePayload(node);
    if (payload) {
      openings.push(payload);
      continue;
    }
    edges
      .filter((edge) => edge.sourceNodeId === nodeId)
      .sort((a, b) => `${a.sourceHandle ?? ""}:${a.id}`.localeCompare(`${b.sourceHandle ?? ""}:${b.id}`))
      .forEach((edge) => queue.push(edge.targetNodeId));
  }

  return openings.length > 0 ? openings : { botId, noOpeningMessage: true };
}

export async function buildCampaignContentSnapshot(campaign: Campaign): Promise<string> {
  if (campaign.waBotId) {
    return JSON.stringify(canonicalize({
      kind: "bot",
      opening: await resolveBotOpening(campaign.waBotId),
    }));
  }
  if (campaign.waTemplateId) {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, campaign.waTemplateId));
    return JSON.stringify(canonicalize({
      kind: "template",
      name: template?.name ?? campaign.waTemplateId,
      language: template?.languageCode,
      headerMedia: {
        storageKey: campaign.metaTemplateHeaderMediaStorageKey,
        type: campaign.metaTemplateHeaderMediaType,
      },
      headerParams: campaign.metaTemplateHeaderParams,
      bodyParams: campaign.metaTemplateBodyParams,
    }));
  }
  throw new Error("Campanha sem template ou bot para gerar assinatura");
}

export function fingerprintForClient(snapshot: string, client: Client, phone: string): string {
  const variables = buildClientVariables(client, phone);
  const resolved = snapshot.replace(/\{\{([^{}]+)\}\}/g, (token, key: string) => {
    const value = variables[key.trim()];
    return value === undefined ? token : value;
  });
  return digest(resolved);
}

export async function findConflict(
  executor: DbExecutor,
  phoneNormalized: string,
  contentFingerprint: string,
  scheduledFor: Date,
  windowHours: number,
): Promise<CampaignDedupeConflict | null> {
  const [conflict] = await executor
    .select({
      campaignId: whatsappCampaignImpacts.campaignId,
      campaignMessageId: whatsappCampaignImpacts.campaignMessageId,
      scheduledFor: whatsappCampaignImpacts.scheduledFor,
    })
    .from(whatsappCampaignImpacts)
    .where(
      and(
        eq(whatsappCampaignImpacts.phoneNormalized, phoneNormalized),
        eq(whatsappCampaignImpacts.contentFingerprint, contentFingerprint),
        inArray(whatsappCampaignImpacts.status, ["reserved", "sent"]),
        sql`(
          (
            ${whatsappCampaignImpacts.status} = 'sent'
            AND ${scheduledFor} >= COALESCE(
              ${whatsappCampaignImpacts.sentAt},
              ${whatsappCampaignImpacts.scheduledFor}
            )
            AND EXTRACT(
              EPOCH FROM (
                ${scheduledFor} - COALESCE(
                  ${whatsappCampaignImpacts.sentAt},
                  ${whatsappCampaignImpacts.scheduledFor}
                )
              )
            ) < ${windowHours * 3600}
          )
          OR
          (
            ${whatsappCampaignImpacts.status} = 'reserved'
            AND (
              (
                ${whatsappCampaignImpacts.scheduledFor} > NOW()
                AND ABS(
                  EXTRACT(
                    EPOCH FROM (
                      ${whatsappCampaignImpacts.scheduledFor} - ${scheduledFor}
                    )
                  )
                ) < ${windowHours * 3600}
              )
              OR
              (
                ${whatsappCampaignImpacts.scheduledFor} <= NOW()
                AND EXTRACT(
                  EPOCH FROM (GREATEST(${scheduledFor}, NOW()) - NOW())
                ) < ${windowHours * 3600}
              )
            )
          )
        )`,
      ),
    )
    .limit(1);
  return conflict ? { ...conflict, phoneMasked: maskPhone(phoneNormalized) } : null;
}

export async function reserveCampaignMessage(input: {
  campaignId: string;
  client: Client;
  phoneNormalized: string;
  contentFingerprint: string;
  scheduledFor: Date;
  windowHours: number;
  postSendTagRequested: boolean;
}): Promise<{ queued: boolean; alreadyExisted: boolean; conflict: CampaignDedupeConflict | null }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.phoneNormalized}), hashtext(${input.contentFingerprint}))`);
    const conflict = await findConflict(
      tx,
      input.phoneNormalized,
      input.contentFingerprint,
      input.scheduledFor,
      input.windowHours,
    );
    const messageId = `${input.campaignId}-${input.client.id}`;
    const insertedRows = await tx
      .insert(whatsappCampaignMessages)
      .values({
        id: messageId,
        campaignId: input.campaignId,
        contactId: input.client.id,
        contactName: input.client.name,
        phoneNumber: input.phoneNormalized,
        phoneNormalized: input.phoneNormalized,
        contentFingerprint: input.contentFingerprint,
        status: conflict ? "suppressed" : "scheduled",
        scheduledAt: input.scheduledFor,
        suppressionReason: conflict ? "Mensagem idêntica dentro da janela de proteção" : null,
        conflictingCampaignMessageId: conflict?.campaignMessageId ?? null,
        tagApplicationStatus: input.postSendTagRequested ? "pending" : "not_requested",
      })
      .onConflictDoNothing()
      .returning({ id: whatsappCampaignMessages.id });
    const inserted = insertedRows.length > 0;
    if (inserted && !conflict) {
      await tx
        .insert(whatsappCampaignImpacts)
        .values({
          phoneNormalized: input.phoneNormalized,
          contentFingerprint: input.contentFingerprint,
          campaignId: input.campaignId,
          campaignMessageId: messageId,
          scheduledFor: input.scheduledFor,
        })
        .onConflictDoNothing();
    }
    return { queued: inserted && !conflict, alreadyExisted: !inserted, conflict };
  });
}

export async function markImpactSent(campaignMessageId: string, sentAt: Date): Promise<void> {
  await db
    .update(whatsappCampaignImpacts)
    .set({ status: "sent", sentAt, updatedAt: new Date() })
    .where(eq(whatsappCampaignImpacts.campaignMessageId, campaignMessageId));
}

export async function releaseImpact(campaignMessageId: string, cancelled = false): Promise<void> {
  await db
    .update(whatsappCampaignImpacts)
    .set({ status: cancelled ? "cancelled" : "released", updatedAt: new Date() })
    .where(eq(whatsappCampaignImpacts.campaignMessageId, campaignMessageId));
}

export async function applyCampaignTag(clientId: string | null, tagId: string | null): Promise<void> {
  if (!clientId || !tagId) return;
  await db
    .insert(contactTags)
    .values({ clientId, whatsappTagId: tagId })
    .onConflictDoNothing();
}

export async function loadCampaignClients(clientIds: string[]): Promise<EligibleClient[]> {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      whatsappOptOut: clients.whatsappOptOut,
    })
    .from(clients)
    .where(inArray(clients.id, clientIds));
}

export async function loadCampaign(campaignId: string): Promise<Campaign | null> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  return campaign ?? null;
}
