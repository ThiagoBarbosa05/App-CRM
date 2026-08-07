import cron from "node-cron";
import { db, pool } from "server/db";
import { campaigns, whatsappCampaigns, whatsappCampaignMessages } from "@shared/schema";
import { and, eq, count, getTableColumns, inArray, lte } from "drizzle-orm";
import { executeCampaign } from "../services/whatsapp-campaign.service";
import { decideFinalization } from "../services/whatsapp-campaign-finalize";
import { classifyDispatchFailure } from "../services/whatsapp-errors";
import { failCampaign } from "../services/whatsapp-campaign-failure";

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

    // Processa apenas campanhas em andamento (pausadas/canceladas ficam de fora).
    // innerJoin com `campaigns` exclui linhas órfãs de whatsapp_campaigns sem
    // linha correspondente (ex: legado do Umbler Talk) — sem isso o dispatcher
    // ficaria tentando (e falhando) disparar a mesma campanha órfã a cada tick,
    // para sempre. Não filtramos por campaigns.deletedAt: uma campanha
    // soft-deletada em voo deve continuar até finalizar normalmente.
    const active = await db
      .select(getTableColumns(whatsappCampaigns))
      .from(whatsappCampaigns)
      .innerJoin(campaigns, eq(campaigns.id, whatsappCampaigns.id))
      .where(eq(whatsappCampaigns.status, "in_progress"));

    if (active.length === 0) return;

    for (const camp of active) {
      try {
        const result = await executeCampaign(camp.id, { limit: BATCH_SIZE });
        // Se o loop de envio percebeu que a campanha não está mais
        // "in_progress" (pausada/cancelada no meio do batch), pula o
        // finalize — recalcular/gravar contadores nela agora seria incorreto.
        if (!result.halted) {
          await finalizeIfDone(camp.id);
        }
        if (result.sent > 0 || result.failed > 0) {
          console.log(
            `[wa-campaign-dispatcher] ${camp.title} | ok=${result.sent} fail=${result.failed} skip=${result.skipped}`,
          );
        }
      } catch (err) {
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
            `[wa-campaign-dispatcher] campanha ${camp.id} encerrada por falha estrutural [${verdict.code}]: ${detail}`,
          );
          try {
            await failCampaign(camp.id, verdict.code, detail);
          } catch (failErr) {
            console.error(
              `[wa-campaign-dispatcher] não foi possível encerrar a campanha ${camp.id}:`,
              failErr,
            );
          }
        } else {
          // Transitório (rede, banco): deve mesmo ser retentado no próximo tick.
          console.error(
            `[wa-campaign-dispatcher] erro na campanha ${camp.id}:`,
            err,
          );
        }
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
