import { db } from "server/db";
import { emailCampaigns, emailCampaignRecipients, clients, users, type EmailCampaign, type InsertEmailCampaign } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { sendEmail, EmailApiError } from "../integrations/email";
import { resolveTargetClients, type MarketingTargetType } from "./marketing-targeting.service";

export async function listCampaigns(): Promise<(EmailCampaign & { creator: { name: string } | null })[]> {
  const rows = await db
    .select({ campaign: emailCampaigns, creatorName: users.name })
    .from(emailCampaigns)
    .leftJoin(users, eq(emailCampaigns.createdBy, users.id))
    .orderBy(desc(emailCampaigns.createdAt));
  return rows.map((r) => ({ ...r.campaign, creator: r.creatorName ? { name: r.creatorName } : null }));
}

export async function getCampaign(id: string) {
  const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
  if (!campaign) return null;
  const recipients = await db
    .select()
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, id));
  return { ...campaign, recipients };
}

export async function createCampaign(
  input: Omit<InsertEmailCampaign, "status" | "sentAt" | "totalRecipients" | "sentCount">,
): Promise<EmailCampaign> {
  const [campaign] = await db
    .insert(emailCampaigns)
    .values({ ...input, status: "draft" })
    .returning();
  return campaign;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const result = await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Enfileira uma campanha "draft" para envio: resolve os destinatários,
 * cria uma linha pendente por destinatário e marca a campanha como
 * "scheduled" — o dispatcher (server/jobs/email-campaign-dispatcher.ts)
 * processa as linhas pendentes em lotes.
 */
export async function queueCampaignForSend(id: string): Promise<EmailCampaign> {
  const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
  if (!campaign) throw new Error(`Campanha ${id} não encontrada`);
  if (campaign.status !== "draft") {
    throw new Error(`Campanha ${id} já foi enviada ou está agendada`);
  }

  const targets = await resolveTargetClients(
    campaign.targetType as MarketingTargetType,
    campaign.targetCriteria,
  );
  const recipients = targets.filter((c) => c.email && c.email.trim() !== "");

  if (recipients.length === 0) {
    throw new Error("Nenhum destinatário com e-mail cadastrado para os critérios selecionados");
  }

  await db.insert(emailCampaignRecipients).values(
    recipients.map((c) => ({
      campaignId: id,
      clientId: c.id,
      status: "pending" as const,
    })),
  );

  const [updated] = await db
    .update(emailCampaigns)
    .set({
      status: "scheduled",
      scheduledAt: campaign.scheduledAt ?? new Date(),
      totalRecipients: recipients.length,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, id))
    .returning();
  return updated;
}

/**
 * Processa até `limit` destinatários pendentes de uma campanha "scheduled",
 * enviando de fato o e-mail via SendGrid. Chamado pelo dispatcher (cron).
 */
export async function executeCampaign(
  campaignId: string,
  opts?: { limit?: number },
): Promise<{ sent: number; failed: number }> {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId));
  if (!campaign || campaign.status !== "scheduled") return { sent: 0, failed: 0 };

  const pendingQuery = db
    .select()
    .from(emailCampaignRecipients)
    .where(
      and(
        eq(emailCampaignRecipients.campaignId, campaignId),
        eq(emailCampaignRecipients.status, "pending"),
      ),
    );
  const pending = opts?.limit ? await pendingQuery.limit(opts.limit) : await pendingQuery;

  let sent = 0;
  let failed = 0;

  for (const recipient of pending) {
    const [client] = await db.select().from(clients).where(eq(clients.id, recipient.clientId));

    if (!client?.email) {
      await db
        .update(emailCampaignRecipients)
        .set({ status: "failed", errorMessage: "Cliente sem e-mail" })
        .where(eq(emailCampaignRecipients.id, recipient.id));
      failed++;
      continue;
    }

    try {
      await sendEmail({ to: client.email, subject: campaign.subject, html: campaign.content });
      await db
        .update(emailCampaignRecipients)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(emailCampaignRecipients.id, recipient.id));
      sent++;
    } catch (err) {
      const message = err instanceof EmailApiError ? err.message : err instanceof Error ? err.message : String(err);
      await db
        .update(emailCampaignRecipients)
        .set({ status: "failed", errorMessage: message })
        .where(eq(emailCampaignRecipients.id, recipient.id));
      failed++;
    }
  }

  return { sent, failed };
}

export async function countPendingRecipients(campaignId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(emailCampaignRecipients)
    .where(
      and(
        eq(emailCampaignRecipients.campaignId, campaignId),
        eq(emailCampaignRecipients.status, "pending"),
      ),
    );
  return Number(value);
}

export async function countSentRecipients(campaignId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(emailCampaignRecipients)
    .where(
      and(
        eq(emailCampaignRecipients.campaignId, campaignId),
        eq(emailCampaignRecipients.status, "sent"),
      ),
    );
  return Number(value);
}

export async function markCampaignSent(campaignId: string): Promise<void> {
  const sentCount = await countSentRecipients(campaignId);
  await db
    .update(emailCampaigns)
    .set({ status: "sent", sentAt: new Date(), sentCount, updatedAt: new Date() })
    .where(eq(emailCampaigns.id, campaignId));
}
