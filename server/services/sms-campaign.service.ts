import { db } from "server/db";
import {
  smsCampaigns,
  smsCampaignMessages,
  smsIndividualMessages,
  clients,
  users,
  type SmsCampaign,
  type InsertSmsCampaign,
  type SmsIndividualMessage,
} from "@shared/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { sendSms, SmsApiError } from "../integrations/sms";
import { resolveTargetClients, type MarketingTargetType } from "./marketing-targeting.service";
import { getServerBaseUrl } from "../lib/twilio-config";

function resolveCampaignMessage(template: string, clientName: string): string {
  const firstName = clientName ? clientName.split(" ")[0] : "";
  return template
    .replaceAll("{{primeiro_nome}}", firstName)
    .replaceAll("{{nome_completo}}", clientName);
}

export interface ListCampaignsResult {
  data: (SmsCampaign & { creator: { name: string } | null })[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export async function listCampaigns(page = 1, pageSize = 20): Promise<ListCampaignsResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;

  const deliveredSub = db
    .select({ n: count() })
    .from(smsCampaignMessages)
    .where(and(eq(smsCampaignMessages.campaignId, smsCampaigns.id), eq(smsCampaignMessages.status, "delivered")));

  const failedSub = db
    .select({ n: count() })
    .from(smsCampaignMessages)
    .where(and(eq(smsCampaignMessages.campaignId, smsCampaigns.id), eq(smsCampaignMessages.status, "failed")));

  const [rows, [{ value: totalItems }]] = await Promise.all([
    db
      .select({
        campaign: smsCampaigns,
        creatorName: users.name,
        deliveredCount: sql<number>`(${deliveredSub})`.as("delivered_count"),
        failedCount: sql<number>`(${failedSub})`.as("failed_count"),
      })
      .from(smsCampaigns)
      .leftJoin(users, eq(smsCampaigns.createdBy, users.id))
      .orderBy(desc(smsCampaigns.createdAt))
      .limit(safePageSize)
      .offset(offset),
    db.select({ value: count() }).from(smsCampaigns),
  ]);

  return {
    data: rows.map((r) => ({
      ...r.campaign,
      creator: r.creatorName ? { name: r.creatorName } : null,
      deliveredCount: Number(r.deliveredCount ?? 0),
      failedCount: Number(r.failedCount ?? 0),
    })),
    page: safePage,
    pageSize: safePageSize,
    totalItems: Number(totalItems),
    totalPages: Math.max(1, Math.ceil(Number(totalItems) / safePageSize)),
  };
}

export async function listIndividualMessages(page = 1, pageSize = 30) {
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        msg: smsIndividualMessages,
        clientName: clients.name,
        sentByName: users.name,
      })
      .from(smsIndividualMessages)
      .leftJoin(clients, eq(smsIndividualMessages.clientId, clients.id))
      .leftJoin(users, eq(smsIndividualMessages.sentBy, users.id))
      .orderBy(desc(smsIndividualMessages.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(smsIndividualMessages),
  ]);

  return {
    data: rows.map((r) => ({
      ...r.msg,
      clientName: r.clientName ?? null,
      sentByName: r.sentByName ?? null,
    })),
    totalItems: Number(total),
    totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)),
    page: safePage,
  };
}

export async function getCampaign(id: string) {
  const [campaign] = await db.select().from(smsCampaigns).where(eq(smsCampaigns.id, id));
  if (!campaign) return null;
  const recipients = await db
    .select()
    .from(smsCampaignMessages)
    .where(eq(smsCampaignMessages.campaignId, id));
  return { ...campaign, recipients };
}

export async function createCampaign(
  input: Omit<InsertSmsCampaign, "status" | "sentAt" | "totalRecipients" | "sentCount">,
): Promise<SmsCampaign> {
  const targetedClients = await resolveTargetClients(
    (input.targetType ?? "all") as MarketingTargetType,
    input.targetCriteria ?? null,
  );
  const withPhone = targetedClients.filter((c) => c.phone?.trim());
  const [campaign] = await db
    .insert(smsCampaigns)
    .values({ ...input, status: "draft", totalRecipients: withPhone.length })
    .returning();
  return campaign;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const result = await db.delete(smsCampaigns).where(eq(smsCampaigns.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Enfileira uma campanha "draft" para envio: resolve os destinatários,
 * cria uma linha pendente por destinatário e marca a campanha como
 * "scheduled" — o dispatcher (server/jobs/sms-campaign-dispatcher.ts)
 * processa as linhas pendentes em lotes.
 */
export async function queueCampaignForSend(id: string, scheduledAt?: Date): Promise<SmsCampaign> {
  const [campaign] = await db.select().from(smsCampaigns).where(eq(smsCampaigns.id, id));
  if (!campaign) throw new Error(`Campanha ${id} não encontrada`);
  if (campaign.status !== "draft") {
    throw new Error(`Campanha ${id} já foi enviada ou está agendada`);
  }

  const targets = await resolveTargetClients(
    campaign.targetType as MarketingTargetType,
    campaign.targetCriteria,
  );
  const recipients = targets.filter((c) => c.phone && c.phone.trim() !== "");

  if (recipients.length === 0) {
    throw new Error("Nenhum destinatário com telefone cadastrado para os critérios selecionados");
  }

  await db.insert(smsCampaignMessages).values(
    recipients.map((c) => ({
      campaignId: id,
      clientId: c.id,
      phone: c.phone!,
      status: "pending" as const,
    })),
  );

  const resolvedScheduledAt = scheduledAt ?? campaign.scheduledAt ?? new Date();
  const [updated] = await db
    .update(smsCampaigns)
    .set({
      status: "scheduled",
      scheduledAt: resolvedScheduledAt,
      totalRecipients: recipients.length,
      updatedAt: new Date(),
    })
    .where(eq(smsCampaigns.id, id))
    .returning();
  return updated;
}

/**
 * Processa até `limit` destinatários pendentes de uma campanha "scheduled",
 * enviando de fato o SMS via Twilio. Chamado pelo dispatcher (cron).
 */
export async function executeCampaign(
  campaignId: string,
  opts?: { limit?: number },
): Promise<{ sent: number; failed: number }> {
  const [campaign] = await db
    .select()
    .from(smsCampaigns)
    .where(eq(smsCampaigns.id, campaignId));
  if (!campaign || campaign.status !== "scheduled") return { sent: 0, failed: 0 };

  const pendingQuery = db
    .select({
      id: smsCampaignMessages.id,
      phone: smsCampaignMessages.phone,
      clientName: clients.name,
    })
    .from(smsCampaignMessages)
    .leftJoin(clients, eq(smsCampaignMessages.clientId, clients.id))
    .where(
      and(
        eq(smsCampaignMessages.campaignId, campaignId),
        eq(smsCampaignMessages.status, "pending"),
      ),
    );
  const pending = opts?.limit ? await pendingQuery.limit(opts.limit) : await pendingQuery;

  let sent = 0;
  let failed = 0;

  for (const recipient of pending) {
    try {
      const body = resolveCampaignMessage(campaign.message, recipient.clientName ?? "");
      const baseUrl = await getServerBaseUrl();
      const { sid } = await sendSms({
        to: recipient.phone,
        body,
        statusCallback: `${baseUrl}/api/twilio/sms-status`,
      });
      await db
        .update(smsCampaignMessages)
        .set({ status: "sent", sentAt: new Date(), twilioSid: sid })
        .where(eq(smsCampaignMessages.id, recipient.id));
      sent++;
    } catch (err) {
      const message = err instanceof SmsApiError ? err.message : err instanceof Error ? err.message : String(err);
      await db
        .update(smsCampaignMessages)
        .set({ status: "failed", errorMessage: message })
        .where(eq(smsCampaignMessages.id, recipient.id));
      failed++;
    }
  }

  return { sent, failed };
}

export async function countPendingRecipients(campaignId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(smsCampaignMessages)
    .where(
      and(
        eq(smsCampaignMessages.campaignId, campaignId),
        eq(smsCampaignMessages.status, "pending"),
      ),
    );
  return Number(value);
}

export async function countSentRecipients(campaignId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(smsCampaignMessages)
    .where(
      and(
        eq(smsCampaignMessages.campaignId, campaignId),
        eq(smsCampaignMessages.status, "sent"),
      ),
    );
  return Number(value);
}

export async function markCampaignSent(campaignId: string): Promise<void> {
  const sentCount = await countSentRecipients(campaignId);
  await db
    .update(smsCampaigns)
    .set({ status: "sent", sentAt: new Date(), sentCount, updatedAt: new Date() })
    .where(eq(smsCampaigns.id, campaignId));
}

/**
 * Envia um SMS avulso (fora de campanha) e registra o resultado em
 * sms_individual_messages para auditoria e para contabilizar nos cards de
 * resumo da página Marketing.
 */
export async function sendIndividualSms(input: {
  to: string;
  message: string;
  clientId?: string;
  sentBy: string;
}): Promise<SmsIndividualMessage> {
  try {
    const baseUrl = await getServerBaseUrl();
    const { sid } = await sendSms({
      to: input.to,
      body: input.message,
      statusCallback: `${baseUrl}/api/twilio/sms-status`,
    });
    const [row] = await db
      .insert(smsIndividualMessages)
      .values({
        clientId: input.clientId ?? null,
        phone: input.to,
        message: input.message,
        status: "sent",
        twilioSid: sid,
        sentBy: input.sentBy,
      })
      .returning();
    return row;
  } catch (err) {
    const message = err instanceof SmsApiError ? err.message : err instanceof Error ? err.message : String(err);
    await db.insert(smsIndividualMessages).values({
      clientId: input.clientId ?? null,
      phone: input.to,
      message: input.message,
      status: "failed",
      errorMessage: message,
      sentBy: input.sentBy,
    });
    throw err instanceof SmsApiError ? err : new SmsApiError(message);
  }
}
