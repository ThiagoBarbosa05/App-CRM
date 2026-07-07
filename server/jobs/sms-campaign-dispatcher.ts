import cron from "node-cron";
import { db, pool } from "server/db";
import { smsCampaigns } from "@shared/schema";
import { and, eq, lte } from "drizzle-orm";
import {
  executeCampaign,
  countPendingRecipients,
  markCampaignSent,
} from "../services/sms-campaign.service";

// Destinatários processados por tick, por campanha — evita estourar o rate
// limit do Twilio em campanhas grandes.
const BATCH_SIZE = 25;

// Chave arbitrária e estável para o advisory lock do Postgres — garante que
// só uma instância do servidor processe um tick por vez.
const SMS_DISPATCH_LOCK_KEY = 727_100_003;

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

let running = false;
cron.schedule("*/1 * * * *", async () => {
  if (running) return;
  running = true;
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [SMS_DISPATCH_LOCK_KEY],
      );
      if (!rows[0]?.locked) return;
      try {
        await runTick();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [SMS_DISPATCH_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  } finally {
    running = false;
  }
});

console.log("[sms-campaign-dispatcher] agendado: a cada 1 minuto");
