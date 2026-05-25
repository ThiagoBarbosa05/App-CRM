import cron from "node-cron";
import { db } from "server/db";
import {
  campaigns,
  campaignClients,
  calls,
  clients,
  systemSettings,
} from "@shared/schema";
import { and, eq, isNull, lte, or, sql, inArray, gte } from "drizzle-orm";
import twilio from "twilio";
import {
  getTwilioConfig,
  getServerBaseUrl,
  toE164Brazil,
} from "../lib/twilio-config";

const BACKOFF_MINUTES = [30, 120, 1440]; // 30min, 2h, 1 dia
const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1; // primeira + 3 retries

async function getDispatchSettings(): Promise<{
  batchSize: number;
  intervalMs: number;
}> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(
      inArray(systemSettings.key, [
        "campaign_dispatch_batch_size",
        "campaign_dispatch_interval_ms",
      ]),
    );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    batchSize: parseInt(map["campaign_dispatch_batch_size"] || "10", 10),
    intervalMs: parseInt(map["campaign_dispatch_interval_ms"] || "1500", 10),
  };
}

async function dispatchCampaign(
  campaign: typeof campaigns.$inferSelect,
  twilioClient: ReturnType<typeof twilio>,
  fromNumber: string,
  baseUrl: string,
  statusCallback: string,
  batchSize: number,
  intervalMs: number,
): Promise<{ processed: number; failed: number }> {
  if (!campaign.createdBy) {
    console.warn(
      `[campaign-dispatcher] campanha ${campaign.id} sem createdBy — skip`,
    );
    return { processed: 0, failed: 0 };
  }
  // Busca elegíveis: status=novo OU status em retryable com next_attempt_at <= now
  const now = new Date();
  const retryableStatuses = ["nao_atendeu", "ocupado", "caixa_postal"] as const;

  const eligible = await db
    .select({
      ccId: campaignClients.id,
      clientId: campaignClients.clientId,
      status: campaignClients.status,
      attempts: campaignClients.attempts,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(campaignClients)
    .leftJoin(clients, eq(campaignClients.clientId, clients.id))
    .where(
      and(
        eq(campaignClients.campaignId, campaign.id),
        or(
          eq(campaignClients.status, "novo"),
          and(
            inArray(campaignClients.status, [...retryableStatuses]),
            lte(campaignClients.attempts, MAX_ATTEMPTS - 1),
            or(
              isNull(campaignClients.nextAttemptAt),
              lte(campaignClients.nextAttemptAt, now),
            ),
          ),
        ),
      ),
    )
    .limit(batchSize);

  let processed = 0;
  let failed = 0;

  for (const cc of eligible) {
    if (!cc.clientPhone) continue;

    // Reserva atomicamente
    const [reserved] = await db
      .update(campaignClients)
      .set({
        status: "contactado",
        attempts: sql`${campaignClients.attempts} + 1`,
        lastAttemptAt: now,
        nextAttemptAt: null,
      })
      .where(
        and(
          eq(campaignClients.id, cc.ccId),
          or(
            eq(campaignClients.status, "novo"),
            inArray(campaignClients.status, [...retryableStatuses]),
          ),
        ),
      )
      .returning({ id: campaignClients.id });
    if (!reserved) continue;

    const [callRecord] = await db
      .insert(calls)
      .values({
        clientId: cc.clientId,
        operatorId: campaign.createdBy as string,
        campaignId: campaign.id,
        status: "iniciando",
        startedAt: now,
        type: campaign.type,
        toPhone: cc.clientPhone,
        contactName: cc.clientName,
      })
      .returning();

    const urlParams = new URLSearchParams({
      callRecordId: callRecord.id,
      campaignType: campaign.type,
      ...(campaign.elevenLabsAgentId && { agentId: campaign.elevenLabsAgentId }),
      ...(campaign.elevenLabsVoiceId && { voiceId: campaign.elevenLabsVoiceId }),
    });

    try {
      const e164 = toE164Brazil(cc.clientPhone);
      const call = await twilioClient.calls.create({
        to: e164,
        from: fromNumber,
        url: `${baseUrl}/api/twilio/voice?${urlParams.toString()}`,
        statusCallback,
        statusCallbackMethod: "POST",
      });
      await db
        .update(calls)
        .set({ twilioCallSid: call.sid })
        .where(eq(calls.id, callRecord.id));
      processed++;
    } catch (err) {
      failed++;
      console.error(
        `[campaign-dispatcher] falha ao discar ${cc.clientId}:`,
        err,
      );
      await db
        .update(calls)
        .set({ status: "falhou", endedAt: new Date() })
        .where(eq(calls.id, callRecord.id));

      const nextAttempts = (cc.attempts ?? 0) + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await db
          .update(campaignClients)
          .set({ status: "desqualificado" })
          .where(eq(campaignClients.id, cc.ccId));
      } else {
        const backoffMin =
          BACKOFF_MINUTES[Math.min(nextAttempts - 1, BACKOFF_MINUTES.length - 1)];
        await db
          .update(campaignClients)
          .set({
            status: "novo",
            nextAttemptAt: new Date(Date.now() + backoffMin * 60 * 1000),
          })
          .where(eq(campaignClients.id, cc.ccId));
      }
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { processed, failed };
}

/**
 * Agenda retry para campaign_clients que estão em status terminal retryable
 * mas ainda não têm next_attempt_at setado (ex: chegaram via twilio-status callback).
 */
async function scheduleRetries(): Promise<void> {
  const retryable = await db
    .select({
      id: campaignClients.id,
      attempts: campaignClients.attempts,
      status: campaignClients.status,
    })
    .from(campaignClients)
    .where(
      and(
        inArray(campaignClients.status, [
          "nao_atendeu",
          "ocupado",
          "caixa_postal",
        ]),
        isNull(campaignClients.nextAttemptAt),
        lte(campaignClients.attempts, MAX_ATTEMPTS - 1),
      ),
    )
    .limit(200);

  for (const r of retryable) {
    const backoffMin =
      BACKOFF_MINUTES[
        Math.min((r.attempts ?? 0) - 1, BACKOFF_MINUTES.length - 1)
      ] ?? BACKOFF_MINUTES[0];
    await db
      .update(campaignClients)
      .set({
        nextAttemptAt: new Date(Date.now() + backoffMin * 60 * 1000),
      })
      .where(eq(campaignClients.id, r.id));
  }
}

async function runTick(): Promise<void> {
  try {
    const now = new Date();
    const ativas = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "ativa"),
          isNull(campaigns.deletedAt),
          or(isNull(campaigns.startDate), lte(campaigns.startDate, now)),
          or(isNull(campaigns.endDate), gte(campaigns.endDate, now)),
        ),
      );
    if (ativas.length === 0) return;

    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      console.warn("[campaign-dispatcher] Twilio não configurado — skip tick");
      return;
    }

    const baseUrl = await getServerBaseUrl();
    const statusCallback =
      config.statusCallbackUrl ?? `${baseUrl}/api/calls/twilio-status`;
    const twilioClient = twilio(config.accountSid, config.authToken);
    const { batchSize, intervalMs } = await getDispatchSettings();

    await scheduleRetries();

    for (const c of ativas) {
      const { processed, failed } = await dispatchCampaign(
        c,
        twilioClient,
        config.fromNumber,
        baseUrl,
        statusCallback,
        batchSize,
        intervalMs,
      );
      if (processed > 0 || failed > 0) {
        console.log(
          `[campaign-dispatcher] ${c.name} | ok=${processed} fail=${failed}`,
        );
      }
    }
  } catch (e) {
    console.error("[campaign-dispatcher] tick error:", e);
  }
}

let running = false;
cron.schedule("*/1 * * * *", async () => {
  if (running) return;
  running = true;
  try {
    await runTick();
  } finally {
    running = false;
  }
});

console.log("[campaign-dispatcher] agendado: a cada 1 minuto");
