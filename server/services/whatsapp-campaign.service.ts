import { db } from "server/db";
import { campaigns, whatsappCampaigns, whatsappCampaignMessages, whatsappTemplates, whatsappBots, whatsappChannels, whatsappMessages, clients } from "@shared/schema";
import { eq, and, or, isNull, lte } from "drizzle-orm";
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
  markImpactSent,
  releaseImpact,
} from "./whatsapp-campaign-dedupe.service";
import {
  validateCampaignRecipient,
  type CampaignAudienceSelector,
} from "./whatsapp-campaign-audience.service";

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
  const errorMessage = err instanceof Error ? err.message : String(err);
  const isRetryable = classifySendError(err) === "retryable";
  const nextAttempts = (msg.attempts ?? 0) + 1;

  if (isRetryable && nextAttempts < MAX_SEND_ATTEMPTS) {
    await db
      .update(whatsappCampaignMessages)
      .set({
        status: "scheduled",
        attempts: nextAttempts,
        nextAttemptAt: new Date(Date.now() + computeBackoffMs(nextAttempts)),
        errorMessage: `Erro transitório — nova tentativa agendada (${nextAttempts}/${MAX_SEND_ATTEMPTS}): ${errorMessage}`,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return "retried";
  }

  await db
    .update(whatsappCampaignMessages)
    .set({ status: "failed", attempts: nextAttempts, errorMessage, updatedAt: new Date() })
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
    .select({ status: whatsappCampaigns.status })
    .from(whatsappCampaigns)
    .where(eq(whatsappCampaigns.id, campaignId));
  return row?.status !== "in_progress";
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

  if (!campaign) throw new Error(`Campanha ${campaignId} não encontrada`);

  if (!campaign.waEnabled) {
    console.log(`[WaCampaign] Campanha ${campaignId} não tem waEnabled — ignorando`);
    return { sent: 0, failed: 0, skipped: 0, retried: 0, halted: false };
  }

  if (!campaign.waTemplateId && !campaign.waBotId) {
    throw new Error(`Campanha ${campaignId} não possui template ou bot configurado`);
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
      throw new Error(
        "O canal de envio da campanha está inativo, desconectado, removido ou sem configuração",
      );
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

    if (!bot) throw new Error(`Bot ${campaign.waBotId} não encontrado`);

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
          .set({ status: "failed", errorMessage: "Telefone ausente", updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }
      const phoneE164 = normalizePhoneE164(msg.phoneNumber);
      if (!phoneE164) {
        await db
          .update(whatsappCampaignMessages)
          .set({ status: "failed", errorMessage: "Telefone inválido", updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }
      try {
        if (!campaign.waChannelId) {
          throw new Error("Campanha de bot sem canal de WhatsApp configurado");
        }
        const { status, lastMessageId, channelId: botChannelId } =
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
            },
          );

        if (status === "opted_out") {
          await db
            .update(whatsappCampaignMessages)
            .set({
              status: "cancelled",
              errorMessage: "Cliente optou por não receber mensagens de marketing",
              updatedAt: new Date(),
            })
            .where(eq(whatsappCampaignMessages.id, msg.id));
          await releaseImpact(msg.id, true);
          skipped++;
          console.log(`[WaCampaign] Bot ⊘ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): opt-out`);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (status === "already_active" || status === "no_start_node") {
          const errorMessage =
            status === "already_active"
              ? "Sessão de bot já ativa para este contato — nenhuma mensagem enviada"
              : "Bot não possui nó inicial configurado";
          await db
            .update(whatsappCampaignMessages)
            .set({ status: "failed", errorMessage, updatedAt: new Date() })
            .where(eq(whatsappCampaignMessages.id, msg.id));
          await releaseImpact(msg.id);
          failed++;
          console.error(`[WaCampaign] Bot ✗ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}): ${errorMessage}`);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        const sentAt = new Date();
        await db
          .update(whatsappCampaignMessages)
          .set({ status: "sent", sentAt, messageId: lastMessageId, updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await completeSuccessfulImpact(msg, campaignLog?.postSendWhatsappTagId ?? null, sentAt);
        await persistCampaignMessageToConversation(phoneE164, lastMessageId, "Disparo via bot", msg.id, botChannelId);
        sent++;
        console.log(`[WaCampaign] Bot ✓ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] Bot ✗ (${outcome}) ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}):`, err instanceof Error ? err.message : err);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  } else {
    // ── Template campaign: enviar mensagem de template para cada contato ──────
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, campaign.waTemplateId!));

    if (!template) throw new Error(`Template ${campaign.waTemplateId} não encontrado`);
    if (
      campaign.waChannelId != null &&
      selectedCampaignChannel?.provider !== "cloud_api"
    ) {
      throw new Error("Campanhas com template exigem um canal Cloud API conectado");
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
          }
        : undefined;

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
          .set({ status: "failed", errorMessage: "Telefone ausente", updatedAt: new Date() })
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
          .set({ status: "failed", errorMessage: "Telefone inválido", updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await releaseImpact(msg.id);
        failed++;
        continue;
      }

      let clientRow: typeof clients.$inferSelect | undefined;
      if (msg.contactId) {
        [clientRow] = await db.select().from(clients).where(eq(clients.id, msg.contactId));
      }
      const clientVars = buildClientVariables(clientRow ?? null, phoneE164);
      const components = buildTemplateComponents(campaign, clientVars);

      try {
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
        await persistCampaignMessageToConversation(phoneE164, waMessageId, `Template: ${template.name}`, msg.id, campaignChannelId);
        sent++;
        console.log(`[WaCampaign] ✓ ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] ✗ (${outcome}) ${msg.contactName} (${maskPhoneForLog(msg.phoneNumber)}):`, err instanceof Error ? err.message : err);
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

async function persistCampaignMessageToConversation(
  phone: string,
  waMessageId: string | null,
  content: string,
  campaignMessageId: string,
  channelId?: number | null,
): Promise<void> {
  try {
    const conversation = await findOrCreateConversation(phone, channelId ?? undefined);
    await db.insert(whatsappMessages).values({
      conversationId: conversation.id,
      channelId: conversation.channelId ?? null,
      waMessageId: waMessageId ?? undefined,
      direction: "outbound",
      type: "text",
      content,
      status: "sent",
      campaignMessageId,
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
