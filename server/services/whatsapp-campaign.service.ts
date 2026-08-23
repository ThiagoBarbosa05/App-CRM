import { db } from "server/db";
import { campaigns, whatsappCampaigns, whatsappCampaignMessages, whatsappCampaignImpacts, whatsappCampaignRetryAudits, whatsappTemplates, whatsappBots, whatsappChannels, whatsappMessages, clients } from "@shared/schema";
import { eq, and, or, isNull, isNotNull, lte, inArray, count, sql } from "drizzle-orm";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { classifySendError, computeBackoffMs } from "./whatsapp-campaign-retry";
import { normalizePhoneE164 } from "@shared/phone";
import { startBotSession, buildClientVariables, interpolate } from "./whatsapp-bot-engine.service";
import { findOrCreateConversation } from "./whatsapp-conversations.service";
import { getChannelByPhoneNumberId, resolveChannelById } from "./whatsapp-channels.service";
import type { ResolvedChannel } from "./whatsapp-channels.service";
import { getPublicR2Url } from "../lib/r2";
import {
  applyCampaignTag,
  findConflict,
  markImpactSent,
  releaseImpact,
} from "./whatsapp-campaign-dedupe.service";
import {
  validateCampaignRecipient,
  type CampaignAudienceSelector,
} from "./whatsapp-campaign-audience.service";
import { CampaignConfigError, CampaignRequeueBlockedError } from "./whatsapp-campaign-errors";
import { describeSendError, waError } from "./whatsapp-errors";
import { encodeCampaignMessageError } from "@shared/whatsapp-error-codes";
import { fetchMetaTemplates } from "./whatsapp-templates.service";
import { buildTemplateMessageSnapshot } from "./whatsapp-message-preview";

// Status a partir dos quais um retry-failed pode "reviver" a campanha para
// in_progress. Qualquer outro status atual (cancelled, paused, created) é
// tratado como bloqueio — ver requeueFailedMessages.
const REQUEUE_ALLOWED_STATUSES = ["completed", "failed", "in_progress"] as const;

const DEFAULT_DELAY_MS = 1000;
const MAX_SEND_ATTEMPTS = 5;

function maskPhoneForLog(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  return digits.length <= 4 ? "****" : `${digits.slice(0, 2)}*****${digits.slice(-2)}`;
}

async function getDelayMs(): Promise<number> {
  try {
    const raw = await getWhatsappSettingsRaw();
    const value = parseInt(raw["wa_message_delay_ms"] ?? "", 10);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY_MS;
  } catch {
    return DEFAULT_DELAY_MS;
  }
}

/**
 * Trata erro de envio: se for retryable (rate-limit, server error, ou erro de
 * rede) e ainda houver tentativas disponíveis, reagenda a mensagem (volta para
 * "scheduled" com nextAttemptAt no futuro) em vez de marcar como falha
 * definitiva — em campanhas de 1000-2000 contatos, erros transitórios são
 * praticamente garantidos de acontecer em algum ponto do envio sequencial.
 */
async function handleSendFailure(
  msg: typeof whatsappCampaignMessages.$inferSelect,
  err: unknown,
): Promise<"retried" | "failed"> {
  // `code` é o que a tela mostra; `detail` guarda o texto cru do provedor
  // (corpo de erro da Meta, mensagem do gateway) para o "Ver detalhe técnico".
  const { code, detail } = describeSendError(err);
  const isRetryable = classifySendError(err) === "retryable";
  const [campaign] = await db
    .select({ cancelRequestedAt: whatsappCampaigns.cancelRequestedAt })
    .from(whatsappCampaigns)
    .where(eq(whatsappCampaigns.id, msg.campaignId));
  const cancellationRequested = Boolean(campaign?.cancelRequestedAt);
  const nextAttempts = (msg.attempts ?? 0) + 1;

  if (!cancellationRequested && isRetryable && nextAttempts < MAX_SEND_ATTEMPTS) {
    await db
      .update(whatsappCampaignMessages)
      .set({
        status: "scheduled",
        attempts: nextAttempts,
        nextAttemptAt: new Date(Date.now() + computeBackoffMs(nextAttempts)),
        errorMessage: encodeCampaignMessageError({
          code: "SEND_RETRY_SCHEDULED",
          attempt: nextAttempts,
          maxAttempts: MAX_SEND_ATTEMPTS,
          detail,
        }),
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return "retried";
  }

  await db
    .update(whatsappCampaignMessages)
    .set({
      status: "failed",
      attempts: nextAttempts,
      errorMessage: encodeCampaignMessageError({
        code,
        attempt: nextAttempts,
        maxAttempts: MAX_SEND_ATTEMPTS,
        detail,
      }),
      updatedAt: new Date(),
    })
    .where(eq(whatsappCampaignMessages.id, msg.id));
  await releaseImpact(msg.id);
  return "failed";
}

async function completeSuccessfulImpact(
  msg: typeof whatsappCampaignMessages.$inferSelect,
  postSendWhatsappTagId: string | null,
  sentAt: Date,
): Promise<void> {
  await markImpactSent(msg.id, sentAt);
  if (!postSendWhatsappTagId) return;
  try {
    await applyCampaignTag(msg.contactId, postSendWhatsappTagId);
    await db
      .update(whatsappCampaignMessages)
      .set({ tagApplicationStatus: "applied", tagApplicationError: null, updatedAt: new Date() })
      .where(eq(whatsappCampaignMessages.id, msg.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(whatsappCampaignMessages)
      .set({ tagApplicationStatus: "failed", tagApplicationError: message, updatedAt: new Date() })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    console.error(`[WaCampaign] Falha ao aplicar etiqueta para ${msg.id}:`, error);
  }
}

/**
 * Verifica se a campanha saiu de "in_progress" (pausada/cancelada pelo
 * operador) enquanto o batch atual estava sendo processado. Chamada antes de
 * cada mensagem nos dois loops de envio — se não estiver mais em andamento,
 * o loop deve parar imediatamente, sem processar as mensagens restantes.
 */
async function isCampaignHalted(campaignId: string): Promise<boolean> {
  const [row] = await db
    .select({
      status: whatsappCampaigns.status,
      cancelRequestedAt: whatsappCampaigns.cancelRequestedAt,
    })
    .from(whatsappCampaigns)
    .where(eq(whatsappCampaigns.id, campaignId));
  return row?.status !== "in_progress" || row.cancelRequestedAt !== null;
}

/** Reserva a mensagem imediatamente antes da fronteira externa. */
async function claimMessageForSending(messageId: string): Promise<boolean> {
  const [claimed] = await db
    .update(whatsappCampaignMessages)
    .set({ status: "sending", updatedAt: new Date() })
    .where(
      and(
        eq(whatsappCampaignMessages.id, messageId),
        eq(whatsappCampaignMessages.status, "scheduled"),
      ),
    )
    .returning({ id: whatsappCampaignMessages.id });
  return Boolean(claimed);
}

/** Efetiva o cancelamento quando a última chamada externa em voo termina. */
async function finalizeRequestedCancellation(campaignId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ cancelRequestedAt: whatsappCampaigns.cancelRequestedAt })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, campaignId))
      .for("update");

    if (!campaign?.cancelRequestedAt) return;

    // Uma resposta transitória pode ter recolocado a mensagem em `scheduled`
    // depois que a transação original de cancelamento varreu a fila. Fecha
    // essa janela antes de verificar se ainda há chamadas externas em voo.
    const cancelledMessages = await tx
      .update(whatsappCampaignMessages)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "scheduled"),
        ),
      )
      .returning({ id: whatsappCampaignMessages.id });
    if (cancelledMessages.length > 0) {
      await tx
        .update(whatsappCampaignImpacts)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          inArray(
            whatsappCampaignImpacts.campaignMessageId,
            cancelledMessages.map(({ id }) => id),
          ),
        );
    }

    const [{ inFlightMessages }] = await tx
      .select({ inFlightMessages: count() })
      .from(whatsappCampaignMessages)
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "sending"),
        ),
      );
    if (Number(inFlightMessages) > 0) return;

    const now = new Date();
    await tx
      .update(whatsappCampaigns)
      .set({ status: "cancelled", completedAt: now, updatedAt: now })
      .where(
        and(
          eq(whatsappCampaigns.id, campaignId),
          isNotNull(whatsappCampaigns.cancelRequestedAt),
        ),
      );
  });
}

async function suppressIfAudienceChanged(
  msg: typeof whatsappCampaignMessages.$inferSelect,
  selector: CampaignAudienceSelector | null,
): Promise<boolean> {
  if (!msg.contactId) return false;
  const reason = await validateCampaignRecipient(msg.contactId, msg.phoneNormalized ?? msg.phoneNumber, selector);
  if (!reason) return false;
  await db.update(whatsappCampaignMessages).set({
    status: "suppressed",
    suppressionReason: reason,
    updatedAt: new Date(),
  }).where(eq(whatsappCampaignMessages.id, msg.id));
  await releaseImpact(msg.id);
  return true;
}

/**
 * Reenfileira mensagens `failed` → `scheduled` de uma campanha, resetando o
 * estado de retry automático (attempts/nextAttemptAt/errorMessage) e
 * restaurando as reservas de dedupe (`whatsapp_campaign_impacts`) que tinham
 * sido liberadas quando cada mensagem falhou. Tudo roda em uma única
 * transação: se a campanha estiver num status que não permite retry, nenhum
 * dos UPDATEs abaixo sobrevive (o throw dispara ROLLBACK).
 */
export async function requeueFailedMessages(
  campaignId: string,
  options: {
    actorId: string;
    overrideDedupe: boolean;
    reason?: string;
  },
): Promise<{ requeued: number; conflicts: number }> {
  return db.transaction(async (tx) => {
    const requeuedMessages = await tx
      .update(whatsappCampaignMessages)
      .set({
        status: "scheduled",
        errorMessage: null,
        attempts: 0,
        nextAttemptAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "failed"),
        ),
      )
      .returning({
        id: whatsappCampaignMessages.id,
        phoneNormalized: whatsappCampaignMessages.phoneNormalized,
        contentFingerprint: whatsappCampaignMessages.contentFingerprint,
      });

    const requeuedIds = requeuedMessages.map((m) => m.id);
    let conflictCount = 0;

    if (requeuedIds.length === 0) {
      return { requeued: 0, conflicts: 0 };
    }

    const [campaign] = await tx
      .select({ status: whatsappCampaigns.status, dedupeWindowHours: whatsappCampaigns.dedupeWindowHours })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, campaignId));

    if (!campaign) {
      throw new CampaignRequeueBlockedError(
        `Campanha ${campaignId} não encontrada.`,
        "not_found",
      );
    }

    if (!REQUEUE_ALLOWED_STATUSES.includes(campaign.status as typeof REQUEUE_ALLOWED_STATUSES[number])) {
      throw new CampaignRequeueBlockedError(
        campaign.status === "cancelled"
          ? "Campanha cancelada não pode ser reprocessada."
          : `Campanha no estado atual (${campaign.status}) não pode ser reprocessada.`,
        campaign.status,
      );
    }

    if (requeuedIds.length > 0) {
      // O mesmo advisory lock da reserva inicial fecha a corrida entre esta
      // revalidação e campanhas concorrentes para telefone + conteúdo.
      const retryAt = new Date();
      const conflicts: Array<{
        campaignId: string;
        campaignMessageId: string;
        conflictingCampaignId: string;
        conflictingCampaignMessageId: string;
        phoneMasked: string;
        scheduledFor: string;
      }> = [];

      for (const message of requeuedMessages) {
        if (!message.phoneNormalized || !message.contentFingerprint) continue;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${message.phoneNormalized}), hashtext(${message.contentFingerprint}))`);
        const conflict = await findConflict(
          tx,
          message.phoneNormalized,
          message.contentFingerprint,
          retryAt,
          campaign.dedupeWindowHours,
        );
        if (conflict && conflict.campaignMessageId !== message.id) {
          conflicts.push({
            campaignId,
            campaignMessageId: message.id,
            conflictingCampaignId: conflict.campaignId,
            conflictingCampaignMessageId: conflict.campaignMessageId,
            phoneMasked: conflict.phoneMasked,
            scheduledFor: conflict.scheduledFor.toISOString(),
          });
        }
      }

      if (conflicts.length > 0 && !options.overrideDedupe) {
        throw new CampaignRequeueBlockedError(
          `${conflicts.length} mensagem(ns) possuem conflito de deduplicação. Confirme o override e informe o motivo para continuar.`,
          "dedupe_conflict",
          { conflicts },
        );
      }
      conflictCount = conflicts.length;

      const restoredImpacts = await tx
        .update(whatsappCampaignImpacts)
        .set({ status: "reserved", scheduledFor: retryAt, sentAt: null, updatedAt: retryAt })
        .where(
          and(
            inArray(whatsappCampaignImpacts.campaignMessageId, requeuedIds),
            eq(whatsappCampaignImpacts.status, "released"),
          ),
        )
        .returning({ campaignMessageId: whatsappCampaignImpacts.campaignMessageId });

      const restoredIds = new Set(restoredImpacts.map((impact) => impact.campaignMessageId));
      const missingMessages = requeuedMessages.filter((message) => !restoredIds.has(message.id));
      const invalidMissing = missingMessages.filter(
        (message) => !message.phoneNormalized || !message.contentFingerprint,
      );
      if (invalidMissing.length > 0) {
        throw new CampaignRequeueBlockedError(
          `Não foi possível restaurar a reserva de deduplicação de ${invalidMissing.length} mensagem(ns).`,
          "dedupe_reservation_invalid",
        );
      }

      let recreatedImpacts: Array<{ campaignMessageId: string }> = [];
      if (missingMessages.length > 0) {
        recreatedImpacts = await tx
          .insert(whatsappCampaignImpacts)
          .values(missingMessages.map((message) => ({
            phoneNormalized: message.phoneNormalized!,
            contentFingerprint: message.contentFingerprint!,
            campaignId,
            campaignMessageId: message.id,
            scheduledFor: retryAt,
            status: "reserved" as const,
          })))
          .onConflictDoNothing()
          .returning({ campaignMessageId: whatsappCampaignImpacts.campaignMessageId });
      }

      if (restoredImpacts.length + recreatedImpacts.length !== requeuedIds.length) {
        throw new CampaignRequeueBlockedError(
          `Não foi possível restaurar a reserva de deduplicação de ${requeuedIds.length - restoredImpacts.length - recreatedImpacts.length} mensagem(ns).`,
          "dedupe_reservation_invalid",
        );
      }

      await tx.insert(whatsappCampaignRetryAudits).values({
        campaignId,
        actorId: options.actorId,
        overrideDedupe: options.overrideDedupe,
        reason: options.overrideDedupe ? options.reason : null,
        requeuedMessages: requeuedIds.length,
        conflicts,
      });
    }

    await tx
      .update(whatsappCampaigns)
      .set({ status: "in_progress", completedAt: null, updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, campaignId));

    return { requeued: requeuedIds.length, conflicts: conflictCount };
  });
}

export async function executeCampaign(
  campaignId: string,
  opts?: { limit?: number },
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  retried: number;
  halted: boolean;
}> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  const [campaignLog] = await db
    .select({
      postSendWhatsappTagId: whatsappCampaigns.postSendWhatsappTagId,
      audienceSelector: whatsappCampaigns.audienceSelector,
    })
    .from(whatsappCampaigns)
    .where(eq(whatsappCampaigns.id, campaignId));

  if (!campaign) {
    throw waError("CAMPAIGN_NOT_FOUND", {
      permanent: true,
      technicalMessage: `Campanha ${campaignId} não encontrada`,
    });
  }

  if (!campaign.waEnabled) {
    console.log(`[WaCampaign] Campanha ${campaignId} não tem waEnabled — ignorando`);
    return { sent: 0, failed: 0, skipped: 0, retried: 0, halted: false };
  }

  if (!campaign.waTemplateId && !campaign.waBotId) {
    throw new CampaignConfigError(`Campanha ${campaignId} não possui template ou bot configurado`);
  }

  const now0 = new Date();
  const pendingQuery = db
    .select()
    .from(whatsappCampaignMessages)
    .where(
      and(
        eq(whatsappCampaignMessages.campaignId, campaignId),
        eq(whatsappCampaignMessages.status, "scheduled"),
        or(
          isNull(whatsappCampaignMessages.nextAttemptAt),
          lte(whatsappCampaignMessages.nextAttemptAt, now0),
        ),
      ),
    );

  const pendingMessages =
    opts?.limit && opts.limit > 0
      ? await pendingQuery.limit(opts.limit)
      : await pendingQuery;

  if (pendingMessages.length === 0) {
    console.log(`[WaCampaign] Nenhuma mensagem pendente para campanha ${campaignId}`);
    return { sent: 0, failed: 0, skipped: 0, retried: 0, halted: false };
  }

  console.log(`[WaCampaign] Enviando ${pendingMessages.length} mensagem(ns) para campanha ${campaignId}`);

  const delayMs = await getDelayMs();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;
  let halted = false;
  let selectedCampaignChannel: ResolvedChannel | null = null;

  if (campaign.waChannelId != null) {
    const [activeChannel] = await db
      .select({
        id: whatsappChannels.id,
        connectionStatus: whatsappChannels.connectionStatus,
      })
      .from(whatsappChannels)
      .where(
        and(
          eq(whatsappChannels.id, campaign.waChannelId),
          eq(whatsappChannels.isActive, true),
          isNull(whatsappChannels.deletedAt),
        ),
      )
      .limit(1);
    selectedCampaignChannel = activeChannel
      ? await resolveChannelById(activeChannel.id)
      : null;
    if (
      !selectedCampaignChannel ||
      (selectedCampaignChannel.provider === "evolution" &&
        activeChannel?.connectionStatus !== "connected")
    ) {
      throw waError("CHANNEL_DISCONNECTED", {
        permanent: true,
        technicalMessage: `Canal ${campaign.waChannelId} da campanha ${campaignId} inativo, desconectado, removido ou sem configuração`,
      });
    }
  }

  if (campaign.waBotId) {
    // ── Bot campaign: iniciar sessão de bot para cada contato ─────────────────
    const [bot] = await db
      .select()
      .from(whatsappBots)
      .where(
        and(
          eq(whatsappBots.id, campaign.waBotId),
          isNull(whatsappBots.deletedAt),
        ),
      );

    if (!bot) {
      throw waError("BOT_NOT_FOUND", {
        permanent: true,
        technicalMessage: `Bot ${campaign.waBotId} não encontrado`,
      });
    }

    for (const msg of pendingMessages) {
      if (await isCampaignHalted(campaignId)) {
        // Operador pausou/cancelou a campanha durante este batch — para de
        // processar mensagens restantes deste tick.
        halted = true;
        break;
      }
      if (await suppressIfAudienceChanged(msg, campaignLog?.audienceSelector as CampaignAudienceSelector | null)) {
        skipped++;
        continue;
      }
      if (!msg.phoneNumber) {
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "failed",
            errorMessage: encodeCampaignMessageError({ code: "SEND_MISSING_PHONE" }),
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }
      const phoneE164 = normalizePhoneE164(msg.phoneNumber);
      if (!phoneE164) {
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "failed",
            errorMessage: encodeCampaignMessageError({ code: "SEND_INVALID_PHONE" }),
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }
      if (!(await claimMessageForSending(msg.id))) {
        halted = true;
        break;
      }
      try {
        if (!campaign.waChannelId) {
          throw waError("CAMPAIGN_NO_CHANNEL", {
            permanent: true,
            technicalMessage: `Campanha de bot ${campaignId} sem canal de WhatsApp configurado`,
          });
        }
        const { status, lastMessageId } =
          await startBotSession(
            campaign.waBotId,
            phoneE164,
            undefined,
            campaignId,
            campaign.waChannelId,
            undefined,
            {
              source: "campaign",
              channelId: campaign.waChannelId,
              campaignId,
              campaignMessageId: msg.id,
              campaignName: campaign.name,
              clientId: msg.contactId ?? null,
            },
          );

        if (status === "opted_out") {
          await db
            .update(whatsappCampaignMessages)
            .set({
              status: "cancelled",
              errorMessage: encodeCampaignMessageError({ code: "SEND_OPTED_OUT" }),
              updatedAt: new Date(),
            })
            .where(eq(whatsappCampaignMessages.id, msg.id));
          await releaseImpact(msg.id, true);
          skipped++;
          console.log(`[WaCampaign] Bot ⊘ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): opt-out`);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (status === "no_start_node") {
          await db
            .update(whatsappCampaignMessages)
            .set({
              status: "failed",
              errorMessage: encodeCampaignMessageError({ code: "BOT_NO_ENTRY_NODE" }),
              updatedAt: new Date(),
            })
            .where(eq(whatsappCampaignMessages.id, msg.id));
          await releaseImpact(msg.id);
          failed++;
          console.error(`[WaCampaign] Bot ✗ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): bot sem nó inicial`);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (status === "already_active") {
          // Condição transitória: o contato já tem uma sessão de bot ativa no
          // momento do disparo (corrida comum quando o bot está no meio de
          // uma conversa). Reagenda com o mesmo backoff de handleSendFailure
          // em vez de falhar de imediato — a sessão ativa tende a terminar em
          // minutos. O impact continua reservado enquanto houver tentativas.
          const nextAttempts = (msg.attempts ?? 0) + 1;
          if (nextAttempts < MAX_SEND_ATTEMPTS) {
            await db
              .update(whatsappCampaignMessages)
              .set({
                status: "scheduled",
                attempts: nextAttempts,
                nextAttemptAt: new Date(Date.now() + computeBackoffMs(nextAttempts)),
                errorMessage: encodeCampaignMessageError({
                  code: "SEND_BOT_SESSION_ACTIVE",
                  attempt: nextAttempts,
                  maxAttempts: MAX_SEND_ATTEMPTS,
                }),
                updatedAt: new Date(),
              })
              .where(eq(whatsappCampaignMessages.id, msg.id));
            retried++;
            console.error(`[WaCampaign] Bot ↻ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): sessão de bot já ativa — reagendado (${nextAttempts}/${MAX_SEND_ATTEMPTS})`);
          } else {
            await db
              .update(whatsappCampaignMessages)
              .set({
                status: "failed",
                attempts: nextAttempts,
                errorMessage: encodeCampaignMessageError({
                  code: "SEND_BOT_SESSION_GAVE_UP",
                  attempt: nextAttempts,
                  maxAttempts: MAX_SEND_ATTEMPTS,
                }),
                updatedAt: new Date(),
              })
              .where(eq(whatsappCampaignMessages.id, msg.id));
            await releaseImpact(msg.id);
            failed++;
            console.error(`[WaCampaign] Bot ✗ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): sessão ativa após ${MAX_SEND_ATTEMPTS} tentativas — desistindo`);
          }
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        const sentAt = new Date();
        await db
          .update(whatsappCampaignMessages)
          .set({ status: "sent", sentAt, messageId: lastMessageId, updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await completeSuccessfulImpact(msg, campaignLog?.postSendWhatsappTagId ?? null, sentAt);
        sent++;
        console.log(`[WaCampaign] Bot ✓ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] Bot ✗ (${outcome}) ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}):`, err instanceof Error ? err.message : err);
      } finally {
        await finalizeRequestedCancellation(campaignId);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  } else {
    // ── Template campaign: enviar mensagem de template para cada contato ──────
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, campaign.waTemplateId!));

    if (!template) {
      throw waError("TEMPLATE_NOT_FOUND", {
        permanent: true,
        technicalMessage: `Template ${campaign.waTemplateId} não encontrado`,
      });
    }
    if (
      campaign.waChannelId != null &&
      selectedCampaignChannel?.provider !== "cloud_api"
    ) {
      throw waError("CHANNEL_NOT_CLOUD_API", {
        permanent: true,
        technicalMessage: `Canal ${campaign.waChannelId} não é cloud_api (provider=${selectedCampaignChannel?.provider ?? "n/a"})`,
      });
    }

    // Resolvido uma vez por execução: o número de disparo é o mesmo para toda a
    // campanha de template.
    const campaignChannelId =
      selectedCampaignChannel?.id ?? (await resolveCampaignChannelId());
    const templateChannelOverride =
      selectedCampaignChannel?.provider === "cloud_api"
        ? {
            phoneNumberId: selectedCampaignChannel.phoneNumberId,
            accessToken: selectedCampaignChannel.accessToken,
            wabaId: selectedCampaignChannel.wabaId,
          }
        : undefined;
    const metaTemplates = await fetchMetaTemplates(templateChannelOverride).catch(
      (error: unknown) => {
        console.error(`[WaCampaign] Não foi possível carregar o conteúdo do template "${template.name}" para o preview:`, error);
        return [];
      },
    );
    const metaTemplate = metaTemplates.find(
      (candidate) =>
        candidate.name === template.name &&
        candidate.language === template.languageCode,
    );

    for (const msg of pendingMessages) {
      if (await isCampaignHalted(campaignId)) {
        // Operador pausou/cancelou a campanha durante este batch — para de
        // processar mensagens restantes deste tick.
        halted = true;
        break;
      }
      if (await suppressIfAudienceChanged(msg, campaignLog?.audienceSelector as CampaignAudienceSelector | null)) {
        skipped++;
        continue;
      }
      if (!msg.phoneNumber) {
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "failed",
            errorMessage: encodeCampaignMessageError({ code: "SEND_MISSING_PHONE" }),
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        console.warn(`[WaCampaign] Mensagem ${msg.id} sem phoneNumber — pulando`);
        failed++;
        continue;
      }
      const phoneE164 = normalizePhoneE164(msg.phoneNumber);
      if (!phoneE164) {
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "failed",
            errorMessage: encodeCampaignMessageError({ code: "SEND_INVALID_PHONE" }),
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }

      if (!(await claimMessageForSending(msg.id))) {
        halted = true;
        break;
      }

      try {
        let clientRow: typeof clients.$inferSelect | undefined;
        if (msg.contactId) {
          [clientRow] = await db.select().from(clients).where(eq(clients.id, msg.contactId));
        }
        const clientVars = buildClientVariables(clientRow ?? null, phoneE164);
        const components = buildTemplateComponents(campaign, clientVars);
        const result = await sendTemplateMessage(
          phoneE164,
          template.name,
          template.languageCode,
          components,
          templateChannelOverride,
        );
        const waMessageId = result?.messages?.[0]?.id ?? null;
        const sentAt = new Date();
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "sent",
            sentAt,
            messageId: waMessageId,
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await completeSuccessfulImpact(msg, campaignLog?.postSendWhatsappTagId ?? null, sentAt);
        const snapshot = buildTemplateMessageSnapshot({
          templateName: template.name,
          language: template.languageCode,
          campaign: { id: campaignId, name: campaign.name },
          templateComponents: metaTemplate?.components ?? [],
          sentComponents: components ?? [],
        });
        await persistCampaignMessageToConversation({
          phone: phoneE164,
          waMessageId,
          type: "template",
          content: snapshot.content,
          rawPayload: snapshot.rawPayload,
          campaignMessageId: msg.id,
          channelId: campaignChannelId,
        });
        sent++;
        console.log(`[WaCampaign] ✓ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] ✗ (${outcome}) ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}):`, err instanceof Error ? err.message : err);
      } finally {
        await finalizeRequestedCancellation(campaignId);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`[WaCampaign] Campanha ${campaignId} concluída — enviadas: ${sent}, falhas: ${failed}, puladas: ${skipped}, reagendadas: ${retried}`);
  return { sent, failed, skipped, retried, halted };
}

/**
 * Canal Cloud API correspondente ao número global de disparo
 * (`wa_phone_number_id` das configurações) — é por ele que a campanha de
 * template sai. Sem isso a mensagem seria gravada na conversa mais antiga do
 * contato em qualquer canal, ou seja, possivelmente no inbox de outro
 * atendente, e a resposta do contato cairia numa conversa diferente da que
 * mostra o disparo.
 */
async function resolveCampaignChannelId(): Promise<number | null> {
  try {
    const raw = await getWhatsappSettingsRaw();
    const phoneNumberId = raw["wa_phone_number_id"];
    if (!phoneNumberId) return null;
    const channel = await getChannelByPhoneNumberId(phoneNumberId);
    return channel?.id ?? null;
  } catch {
    return null;
  }
}

async function persistCampaignMessageToConversation(input: {
  phone: string;
  waMessageId: string | null;
  type: "template";
  content: string;
  rawPayload: object;
  campaignMessageId: string;
  channelId?: number | null;
}): Promise<void> {
  try {
    const conversation = await findOrCreateConversation(
      input.phone,
      input.channelId ?? undefined,
    );
    await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      channelId: conversation.channelId ?? null,
      waMessageId: input.waMessageId ?? undefined,
      direction: "outbound",
      type: input.type,
      content: input.content,
      origin: "campaign",
      rawPayload: input.rawPayload,
      status: "sent",
      campaignMessageId: input.campaignMessageId,
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("[WaCampaign] Erro ao persistir mensagem na conversa:", err);
  }
}

function buildTemplateComponents(
  campaign: typeof campaigns.$inferSelect,
  variables: Record<string, string>,
): object[] | undefined {
  const components: object[] = [];

  if (campaign.metaTemplateHeaderMediaStorageKey && campaign.metaTemplateHeaderMediaType) {
    components.push({
      type: "header",
      parameters: [
        {
          type: campaign.metaTemplateHeaderMediaType,
          [campaign.metaTemplateHeaderMediaType]: {
            link: getPublicR2Url(campaign.metaTemplateHeaderMediaStorageKey),
          },
        },
      ],
    });
  } else if (
    Array.isArray(campaign.metaTemplateHeaderParams) &&
    campaign.metaTemplateHeaderParams.length > 0
  ) {
    components.push({
      type: "header",
      parameters: (campaign.metaTemplateHeaderParams as string[]).map((p) => ({
        type: "text",
        text: interpolate(p, variables),
      })),
    });
  }

  if (Array.isArray(campaign.metaTemplateBodyParams) && campaign.metaTemplateBodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: (campaign.metaTemplateBodyParams as string[]).map((p) => ({
        type: "text",
        text: interpolate(p, variables),
      })),
    });
  }

  return components.length > 0 ? components : undefined;
}
