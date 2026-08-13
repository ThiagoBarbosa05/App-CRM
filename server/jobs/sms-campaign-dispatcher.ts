import { db } from "server/db";
import { smsCampaigns } from "@shared/schema";
import { and, eq, lte } from "drizzle-orm";
import {
  executeCampaign,
  countPendingRecipients,
  markCampaignSent,
} from "../services/sms-campaign.service";
import { LOCK_KEYS } from "./lock-keys";
import { withAdvisoryLock } from "./with-advisory-lock";

// Destinatários processados por tick, por campanha — evita estourar o rate
// limit do Twilio em campanhas grandes.
const BATCH_SIZE = 25;

// Chave arbitrária e estável para o advisory lock do Postgres — garante que
// só uma instância do servidor processe um tick por vez.
const SMS_DISPATCH_LOCK_KEY = LOCK_KEYS.smsCampaignDispatch;

async function runTick(): Promise<void> {
  try {
    const now = new Date();

    const active = await db
      .select()
      .from(smsCampaigns)
      .where(and(eq(smsCampaigns.status, "scheduled"), lte(smsCampaigns.scheduledAt, now)));

    if (active.length === 0) return;

    for (const camp of active) {
      try {
        const result = await executeCampaign(camp.id, { limit: BATCH_SIZE });
        const remaining = await countPendingRecipients(camp.id);
        if (remaining === 0) await markCampaignSent(camp.id);
        if (result.sent > 0 || result.failed > 0) {
          console.log(
            `[sms-campaign-dispatcher] ${camp.name} | ok=${result.sent} fail=${result.failed}`,
          );
        }
      } catch (err) {
        console.error(`[sms-campaign-dispatcher] erro na campanha ${camp.id}:`, err);
      }
    }
  } catch (e) {
    console.error("[sms-campaign-dispatcher] tick error:", e);
  }
}

/** Um tick completo, já protegido pelo advisory lock. Chamado pelo worker. */
export async function runSmsCampaignDispatchTick(): Promise<void> {
  await withAdvisoryLock(SMS_DISPATCH_LOCK_KEY, runTick);
}
