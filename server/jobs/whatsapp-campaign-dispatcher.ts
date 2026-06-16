import cron from "node-cron";
import { db } from "server/db";
import { whatsappCampaigns, whatsappCampaignMessages } from "@shared/schema";
import { and, eq, count, inArray, lte } from "drizzle-orm";
import { executeCampaign } from "../services/whatsapp-campaign.service";

// Mensagens processadas por tick, por campanha. O `wa_message_delay_ms` controla
// o intervalo entre envios dentro de executeCampaign (rate-limit da Meta).
const BATCH_SIZE = 25;

const SENT_LIKE = ["sent", "delivered", "read"] as const;

async function finalizeIfDone(campaignId: string): Promise<void> {
  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        eq(whatsappCampaignMessages.campaignId, campaignId),
        eq(whatsappCampaignMessages.status, "scheduled"),
      ),
    );

  const [{ sent }] = await db
    .select({ sent: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        eq(whatsappCampaignMessages.campaignId, campaignId),
        inArray(whatsappCampaignMessages.status, [...SENT_LIKE]),
      ),
    );

  const [{ failed }] = await db
    .select({ failed: count() })
    .from(whatsappCampaignMessages)
    .where(
      and(
        eq(whatsappCampaignMessages.campaignId, campaignId),
        eq(whatsappCampaignMessages.status, "failed"),
      ),
    );

  const sentNum = Number(sent);
  const failedNum = Number(failed);

  if (Number(remaining) === 0) {
    // Campanha concluída: failed se nada saiu, completed caso contrário.
    await db
      .update(whatsappCampaigns)
      .set({
        status: sentNum === 0 && failedNum > 0 ? "failed" : "completed",
        sentMessages: sentNum,
        failedMessages: failedNum,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaignId));
  } else {
    // Ainda em andamento: atualiza contadores para o monitoramento ao vivo.
    await db
      .update(whatsappCampaigns)
      .set({
        status: "in_progress",
        sentMessages: sentNum,
        failedMessages: failedNum,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, campaignId));
  }
}

async function runTick(): Promise<void> {
  try {
    const now = new Date();

    // Promove campanhas agendadas (created) cujo horário já chegou → in_progress.
    await db
      .update(whatsappCampaigns)
      .set({ status: "in_progress", updatedAt: now })
      .where(
        and(
          eq(whatsappCampaigns.status, "created"),
          lte(whatsappCampaigns.startDate, now),
        ),
      );

    // Processa apenas campanhas em andamento (pausadas/canceladas ficam de fora).
    const active = await db
      .select()
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.status, "in_progress"));

    if (active.length === 0) return;

    for (const camp of active) {
      try {
        const result = await executeCampaign(camp.id, { limit: BATCH_SIZE });
        await finalizeIfDone(camp.id);
        if (result.sent > 0 || result.failed > 0) {
          console.log(
            `[wa-campaign-dispatcher] ${camp.title} | ok=${result.sent} fail=${result.failed} skip=${result.skipped}`,
          );
        }
      } catch (err) {
        console.error(
          `[wa-campaign-dispatcher] erro na campanha ${camp.id}:`,
          err,
        );
      }
    }
  } catch (e) {
    console.error("[wa-campaign-dispatcher] tick error:", e);
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

console.log("[wa-campaign-dispatcher] agendado: a cada 1 minuto");
