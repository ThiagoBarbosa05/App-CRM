import cron from "node-cron";
import { db, pool } from "server/db";
import { whatsappCampaigns, whatsappCampaignMessages } from "@shared/schema";
import { and, eq, count, inArray, lte } from "drizzle-orm";
import { executeCampaign } from "../services/whatsapp-campaign.service";

// Mensagens processadas por tick, por campanha. O `wa_message_delay_ms` controla
// o intervalo entre envios dentro de executeCampaign (rate-limit da Meta).
const BATCH_SIZE = 25;

// Chave arbitrária e estável para o advisory lock do Postgres — garante que
// só uma instância do servidor processe um tick por vez, mesmo com múltiplos
// processos/containers rodando o mesmo cron em produção.
const WA_DISPATCH_LOCK_KEY = 727_100_001;

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
  if (running) return; // já rodando neste processo — evita sobreposição local
  running = true;
  try {
    // Advisory lock do Postgres: se outra instância do servidor já está
    // processando este tick, pg_try_advisory_lock retorna false imediatamente
    // (não bloqueia) e esta instância pula o tick, evitando que duas
    // instâncias enviem a mesma mensagem em paralelo.
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [WA_DISPATCH_LOCK_KEY],
      );
      if (!rows[0]?.locked) return;
      try {
        await runTick();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [WA_DISPATCH_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  } finally {
    running = false;
  }
});

console.log("[wa-campaign-dispatcher] agendado: a cada 1 minuto");
