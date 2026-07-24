import { db } from "server/db";
import { campaigns, whatsappCampaignMessages, whatsappTemplates, whatsappBots, whatsappMessages, clients } from "@shared/schema";
import { eq, and, or, isNull, lte } from "drizzle-orm";
import { sendTemplateMessage, WhatsAppApiError } from "../integrations/whatsapp";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { normalizePhoneE164 } from "@shared/phone";
import { startBotSession, buildClientVariables, interpolate } from "./whatsapp-bot-engine.service";
import { findOrCreateConversation } from "./whatsapp-conversations.service";
import { getChannelByPhoneNumberId } from "./whatsapp-channels.service";
import { getPublicR2Url } from "../lib/r2";

const DEFAULT_DELAY_MS = 1000;
const MAX_SEND_ATTEMPTS = 5;

async function getDelayMs(): Promise<number> {
  try {
    const raw = await getWhatsappSettingsRaw();
    const value = parseInt(raw["wa_message_delay_ms"] ?? "", 10);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY_MS;
  } catch {
    return DEFAULT_DELAY_MS;
  }
}

// Backoff exponencial (5s, 10s, 20s, 40s, 80s...), com teto de 5 minutos.
function computeBackoffMs(attempts: number): number {
  const backoffSeconds = Math.min(5 * Math.pow(2, attempts), 300);
  return backoffSeconds * 1000;
}

/**
 * Trata erro de envio: se for rate-limit (429) da Meta e ainda houver
 * tentativas disponíveis, reagenda a mensagem (volta para "scheduled" com
 * nextAttemptAt no futuro) em vez de marcar como falha definitiva — em
 * campanhas de 1000-2000 contatos, rate-limit é praticamente garantido de
 * acontecer em algum ponto do envio sequencial.
 */
async function handleSendFailure(
  msg: typeof whatsappCampaignMessages.$inferSelect,
  err: unknown,
): Promise<"retried" | "failed"> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const isRateLimited = err instanceof WhatsAppApiError && err.status === 429;
  const nextAttempts = (msg.attempts ?? 0) + 1;

  if (isRateLimited && nextAttempts < MAX_SEND_ATTEMPTS) {
    await db
      .update(whatsappCampaignMessages)
      .set({
        status: "scheduled",
        attempts: nextAttempts,
        nextAttemptAt: new Date(Date.now() + computeBackoffMs(nextAttempts)),
        errorMessage: `Rate limit da Meta — nova tentativa agendada (${nextAttempts}/${MAX_SEND_ATTEMPTS}): ${errorMessage}`,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return "retried";
  }

  await db
    .update(whatsappCampaignMessages)
    .set({ status: "failed", attempts: nextAttempts, errorMessage, updatedAt: new Date() })
    .where(eq(whatsappCampaignMessages.id, msg.id));
  return "failed";
}

export async function executeCampaign(
  campaignId: string,
  opts?: { limit?: number },
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  retried: number;
}> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) throw new Error(`Campanha ${campaignId} não encontrada`);

  if (!campaign.waEnabled) {
    console.log(`[WaCampaign] Campanha ${campaignId} não tem waEnabled — ignorando`);
    return { sent: 0, failed: 0, skipped: 0, retried: 0 };
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
    return { sent: 0, failed: 0, skipped: 0, retried: 0 };
  }

  console.log(`[WaCampaign] Enviando ${pendingMessages.length} mensagem(ns) para campanha ${campaignId}`);

  const delayMs = await getDelayMs();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let retried = 0;

  if (campaign.waBotId) {
    // ── Bot campaign: iniciar sessão de bot para cada contato ─────────────────
    const [bot] = await db
      .select()
      .from(whatsappBots)
      .where(eq(whatsappBots.id, campaign.waBotId));

    if (!bot) throw new Error(`Bot ${campaign.waBotId} não encontrado`);

    for (const msg of pendingMessages) {
      if (!msg.phoneNumber) {
        skipped++;
        continue;
      }
      const phoneE164 = normalizePhoneE164(msg.phoneNumber);
      if (!phoneE164) {
        await db
          .update(whatsappCampaignMessages)
          .set({ status: "failed", errorMessage: "Telefone inválido", updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        failed++;
        continue;
      }
      try {
        const { status, lastMessageId, channelId: botChannelId } = await startBotSession(campaign.waBotId, phoneE164, undefined, campaignId);

        if (status === "opted_out") {
          await db
            .update(whatsappCampaignMessages)
            .set({
              status: "cancelled",
              errorMessage: "Cliente optou por não receber mensagens de marketing",
              updatedAt: new Date(),
            })
            .where(eq(whatsappCampaignMessages.id, msg.id));
          skipped++;
          console.log(`[WaCampaign] Bot ⊘ ${msg.contactName} (${msg.phoneNumber}): opt-out`);
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
          failed++;
          console.error(`[WaCampaign] Bot ✗ ${msg.contactName} (${msg.phoneNumber}): ${errorMessage}`);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        await db
          .update(whatsappCampaignMessages)
          .set({ status: "sent", sentAt: new Date(), messageId: lastMessageId, updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await persistCampaignMessageToConversation(phoneE164, lastMessageId, "Disparo via bot", msg.id, botChannelId);
        sent++;
        console.log(`[WaCampaign] Bot ✓ ${msg.contactName} (${msg.phoneNumber})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] Bot ✗ (${outcome}) ${msg.contactName} (${msg.phoneNumber}):`, err instanceof Error ? err.message : err);
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

    // Resolvido uma vez por execução: o número de disparo é o mesmo para toda a
    // campanha de template.
    const campaignChannelId = await resolveCampaignChannelId();

    for (const msg of pendingMessages) {
      if (!msg.phoneNumber) {
        console.warn(`[WaCampaign] Mensagem ${msg.id} sem phoneNumber — pulando`);
        skipped++;
        continue;
      }
      const phoneE164 = normalizePhoneE164(msg.phoneNumber);
      if (!phoneE164) {
        await db
          .update(whatsappCampaignMessages)
          .set({ status: "failed", errorMessage: "Telefone inválido", updatedAt: new Date() })
          .where(eq(whatsappCampaignMessages.id, msg.id));
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
        );
        const waMessageId = result?.messages?.[0]?.id ?? null;
        await db
          .update(whatsappCampaignMessages)
          .set({
            status: "sent",
            sentAt: new Date(),
            messageId: waMessageId,
            updatedAt: new Date(),
          })
          .where(eq(whatsappCampaignMessages.id, msg.id));
        await persistCampaignMessageToConversation(phoneE164, waMessageId, `Template: ${template.name}`, msg.id, campaignChannelId);
        sent++;
        console.log(`[WaCampaign] ✓ ${msg.contactName} (${msg.phoneNumber})`);
      } catch (err) {
        const outcome = await handleSendFailure(msg, err);
        if (outcome === "retried") retried++; else failed++;
        console.error(`[WaCampaign] ✗ (${outcome}) ${msg.contactName} (${msg.phoneNumber}):`, err instanceof Error ? err.message : err);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`[WaCampaign] Campanha ${campaignId} concluída — enviadas: ${sent}, falhas: ${failed}, puladas: ${skipped}, reagendadas: ${retried}`);
  return { sent, failed, skipped, retried };
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
