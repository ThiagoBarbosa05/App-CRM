import cron from "node-cron";
import { db } from "server/db";
import { whatsappCampaigns, whatsappCampaignMessages } from "@shared/schema";
import { and, eq, count, inArray, lte } from "drizzle-orm";
import { executeCampaign } from "../services/whatsapp-campaign.service";
import { decideFinalization } from "../services/whatsapp-campaign-finalize";
import { classifyDispatchFailure } from "../services/whatsapp-errors";
import { failCampaign } from "../services/whatsapp-campaign-failure";
import {
  claimNextWhatsappCampaignBatch,
  recoverExpiredWhatsappCampaignClaims,
  releaseWhatsappCampaignClaim,
} from "../services/whatsapp-campaign-claim.service";
import { runClaimedCampaignPool } from "../services/whatsapp-campaign-dispatch-pool";

// Mensagens processadas por tick, por campanha. O `wa_message_delay_ms` controla
// o intervalo entre envios dentro de executeCampaign (rate-limit da Meta).
const BATCH_SIZE = 25;

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_LEASE_TIMEOUT_MS = 10 * 60 * 1000;

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

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

  const decision = decideFinalization({
    remaining: Number(remaining),
    sent: sentNum,
    failed: failedNum,
  });

  // Ambos os UPDATEs abaixo exigem status atual === "in_progress". Se o
  // operador pausou/cancelou a campanha enquanto este batch rodava, a linha
  // já não está mais "in_progress" e o UPDATE não afeta nenhuma linha — o
  // pause/cancel vence e não é revertido por este finalize.
  if (decision.terminal) {
    // Campanha concluída: failed se nada saiu, completed caso contrário.
    await db
      .update(whatsappCampaigns)
      .set({
        status: decision.status,
        sentMessages: sentNum,
        failedMessages: failedNum,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappCampaigns.id, campaignId),
          eq(whatsappCampaigns.status, "in_progress"),
        ),
      );
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
      .where(
        and(
          eq(whatsappCampaigns.id, campaignId),
          eq(whatsappCampaigns.status, "in_progress"),
        ),
      );
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

    const leaseTimeoutMs = positiveIntegerEnv(
      "WA_CAMPAIGN_LEASE_TIMEOUT_MS",
      DEFAULT_LEASE_TIMEOUT_MS,
    );
    const recovered = await recoverExpiredWhatsappCampaignClaims(db, { leaseTimeoutMs });
    if (recovered.rescheduled > 0 || recovered.cancelled > 0) {
      console.warn(
        `[wa-campaign-dispatcher] leases recuperados: reagendados=${recovered.rescheduled} cancelados=${recovered.cancelled}`,
      );
    }

    const concurrency = positiveIntegerEnv(
      "WA_CAMPAIGN_CHANNEL_CONCURRENCY",
      DEFAULT_CONCURRENCY,
    );
    await runClaimedCampaignPool({
      concurrency,
      claim: ({ excludedChannelIds }) =>
        claimNextWhatsappCampaignBatch(db, {
          limit: BATCH_SIZE,
          excludedChannelIds,
        }),
      process: async (campaignId, messageIds) => {
        try {
          const result = await executeCampaign(campaignId, {
            claimedMessageIds: messageIds,
          });
          // Pausa/cancelamento pode interromper o loop no meio do lote. Somente
          // mensagens que ainda estiverem `sending` são devolvidas à fila.
          await releaseWhatsappCampaignClaim(db, messageIds);
          // Se o loop de envio percebeu que a campanha não está mais
          // "in_progress" (pausada/cancelada no meio do batch), pula o
          // finalize — recalcular/gravar contadores nela agora seria incorreto.
          if (!result.halted) {
            await finalizeIfDone(campaignId);
          }
          if (result.sent > 0 || result.failed > 0) {
            console.log(
              `[wa-campaign-dispatcher] ${campaignId} | ok=${result.sent} fail=${result.failed} skip=${result.skipped}`,
            );
          }
        } catch (err) {
          await releaseWhatsappCampaignClaim(db, messageIds);
          // Falha estrutural (canal desconectado, bot/template removido, campanha
          // sem conteúdo): retentar no próximo tick não resolve. Antes só logava,
          // e a campanha ficava presa em "in_progress" refazendo a mesma falha a
          // cada minuto, sem nada visível para o operador. Agora ela é encerrada
          // como `failed` com o motivo gravado nas mensagens pendentes, e o
          // caminho de recuperação é o "Reenviar falhas" depois da correção.
          const verdict = classifyDispatchFailure(err);

          if (verdict.permanent) {
            const detail = err instanceof Error ? err.message : String(err);
            console.warn(
              `[wa-campaign-dispatcher] campanha ${campaignId} encerrada por falha estrutural [${verdict.code}]: ${detail}`,
            );
            try {
              await failCampaign(campaignId, verdict.code, detail);
            } catch (failErr) {
              console.error(
                `[wa-campaign-dispatcher] não foi possível encerrar a campanha ${campaignId}:`,
                failErr,
              );
            }
          } else {
            // Transitório (rede, banco): deve mesmo ser retentado no próximo tick.
            console.error(
              `[wa-campaign-dispatcher] erro na campanha ${campaignId}:`,
              err,
            );
          }
        }
      },
    });
  } catch (e) {
    console.error("[wa-campaign-dispatcher] tick error:", e);
  }
}

let running = false;
cron.schedule("*/1 * * * *", async () => {
  if (running) return; // já rodando neste processo — evita sobreposição local
  running = true;
  try {
    await runTick();
  } finally {
    running = false;
  }
});

console.log("[wa-campaign-dispatcher] agendado: a cada 1 minuto");
