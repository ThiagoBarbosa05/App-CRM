import { db } from "server/db";
import { campaigns, umblerCampaignMessages, whatsappTemplates, whatsappBots } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { formatPhoneToDigits } from "../lib/format-phone";
import { startBotSession } from "./whatsapp-bot-engine.service";

const DEFAULT_DELAY_MS = 1000;

async function getDelayMs(): Promise<number> {
  try {
    const raw = await getWhatsappSettingsRaw();
    const value = parseInt(raw["wa_message_delay_ms"] ?? "", 10);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DELAY_MS;
  } catch {
    return DEFAULT_DELAY_MS;
  }
}

export async function executeCampaign(
  campaignId: string,
  opts?: { limit?: number },
): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) throw new Error(`Campanha ${campaignId} não encontrada`);

  if (!campaign.waEnabled) {
    console.log(`[WaCampaign] Campanha ${campaignId} não tem waEnabled — ignorando`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  if (!campaign.waTemplateId && !campaign.waBotId) {
    throw new Error(`Campanha ${campaignId} não possui template ou bot configurado`);
  }

  const pendingQuery = db
    .select()
    .from(umblerCampaignMessages)
    .where(
      and(
        eq(umblerCampaignMessages.campaignId, campaignId),
        eq(umblerCampaignMessages.status, "scheduled"),
      ),
    );

  const pendingMessages =
    opts?.limit && opts.limit > 0
      ? await pendingQuery.limit(opts.limit)
      : await pendingQuery;

  if (pendingMessages.length === 0) {
    console.log(`[WaCampaign] Nenhuma mensagem pendente para campanha ${campaignId}`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  console.log(`[WaCampaign] Enviando ${pendingMessages.length} mensagem(ns) para campanha ${campaignId}`);

  const delayMs = await getDelayMs();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

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
      const phoneE164 = formatPhoneToDigits(msg.phoneNumber);
      try {
        await startBotSession(campaign.waBotId, phoneE164);
        await db
          .update(umblerCampaignMessages)
          .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
          .where(eq(umblerCampaignMessages.id, msg.id));
        sent++;
        console.log(`[WaCampaign] Bot ✓ ${msg.contactName} (${msg.phoneNumber})`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await db
          .update(umblerCampaignMessages)
          .set({ status: "failed", errorMessage, updatedAt: new Date() })
          .where(eq(umblerCampaignMessages.id, msg.id));
        failed++;
        console.error(`[WaCampaign] Bot ✗ ${msg.contactName} (${msg.phoneNumber}):`, errorMessage);
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

    for (const msg of pendingMessages) {
      if (!msg.phoneNumber) {
        console.warn(`[WaCampaign] Mensagem ${msg.id} sem phoneNumber — pulando`);
        skipped++;
        continue;
      }
      const phoneE164 = formatPhoneToDigits(msg.phoneNumber);
      const bodyParams = buildBodyParams(template.bodyParams, msg.contactName);
      const components =
        bodyParams.length > 0 ? [{ type: "body", parameters: bodyParams }] : undefined;

      try {
        const result = await sendTemplateMessage(
          phoneE164,
          template.name,
          template.languageCode,
          components,
        );
        await db
          .update(umblerCampaignMessages)
          .set({
            status: "sent",
            sentAt: new Date(),
            messageId: result?.messages?.[0]?.id ?? null,
            updatedAt: new Date(),
          })
          .where(eq(umblerCampaignMessages.id, msg.id));
        sent++;
        console.log(`[WaCampaign] ✓ ${msg.contactName} (${msg.phoneNumber})`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await db
          .update(umblerCampaignMessages)
          .set({ status: "failed", errorMessage, updatedAt: new Date() })
          .where(eq(umblerCampaignMessages.id, msg.id));
        failed++;
        console.error(`[WaCampaign] ✗ ${msg.contactName} (${msg.phoneNumber}):`, errorMessage);
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`[WaCampaign] Campanha ${campaignId} concluída — enviadas: ${sent}, falhas: ${failed}, puladas: ${skipped}`);
  return { sent, failed, skipped };
}

function buildBodyParams(
  bodyParams: unknown,
  contactName: string,
): { type: string; text: string }[] {
  if (!Array.isArray(bodyParams)) return [];

  return bodyParams.map((param: unknown) => {
    const key = typeof param === "string" ? param : String(param);
    const value = key === "nome" ? contactName.split(" ")[0] : key;
    return { type: "text", text: value };
  });
}
