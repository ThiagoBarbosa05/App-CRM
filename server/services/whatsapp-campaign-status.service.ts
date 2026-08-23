import { count, eq } from "drizzle-orm";
import { db } from "../db";
import {
  whatsappCampaignMessages,
  whatsappCampaigns,
  whatsappMessages,
} from "@shared/schema";

// Ordem das transições de status (não permite regredir: read não volta a delivered).
// Compartilhado entre o webhook da Meta (Cloud API) e os eventos do Baileys/Evolution —
// ambos os canais convergem pra este serviço em vez de cada um manter sua própria cópia.
export const STATUS_RANK: Record<string, number> = {
  scheduled: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * Aplica um status de entrega (sent/delivered/read/failed) reportado por QUALQUER
 * canal (Meta Cloud API via webhook, ou Evolution/Baileys via handleMessagesUpdate)
 * a uma mensagem de campanha (`whatsapp_campaign_messages`).
 *
 * Casamento em duas etapas:
 * 1. Direto: `whatsapp_campaign_messages.message_id === waMessageId`.
 * 2. Fallback via FK: `whatsapp_messages.wa_message_id === waMessageId` →
 *    `whatsapp_messages.campaign_message_id` (gravada por
 *    `persistCampaignMessageToConversation` em whatsapp-campaign.service.ts).
 *    Necessário porque, no caminho de bot, o `messageId` retornado por
 *    `executeNode` pode ser `null` (ex: a última mensagem enviada na cadeia não é
 *    o último nó executado — nó de condição/espera no fim), então o registro de
 *    campanha nunca ganha um `messageId` direto pra casar com o evento de status.
 *
 * Se nenhuma mensagem de campanha for encontrada (nem direto, nem via fallback),
 * não é uma mensagem de campanha — retorna sem fazer nada.
 */
export async function applyCampaignDeliveryStatus(
  waMessageId: string,
  status: "sent" | "delivered" | "read" | "failed",
  opts: { eventAt: Date; errorMessage?: string },
): Promise<void> {
  let msg = await findCampaignMessageByDirectMatch(waMessageId);
  if (!msg) {
    msg = await findCampaignMessageByFallbackFk(waMessageId);
  }
  if (!msg) return;

  await db.transaction(async (tx) => {
    // Serializa webhooks da mesma campanha. Sem este lock, dois eventos para
    // mensagens diferentes podem calcular agregados concorrentes e o último
    // UPDATE sobrescrever uma contagem mais recente. Campanhas distintas não
    // se bloqueiam entre si.
    const [campaign] = await tx
      .select({ id: whatsappCampaigns.id })
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, msg.campaignId))
      .for("update")
      .limit(1);
    if (!campaign) return;

    // A mensagem pode ter mudado enquanto esta transação aguardava o lock.
    const [currentMessage] = await tx
      .select()
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.id, msg.id))
      .limit(1);
    if (!currentMessage) return;

    // Estado terminal: já falhou definitivamente ou a campanha foi cancelada —
    // nenhum evento posterior deve reabrir/alterar o registro.
    if (currentMessage.status === "failed" || currentMessage.status === "cancelled") return;

    if (status === "failed") {
      // NÃO libera o impact: a mensagem saiu e a falha foi reportada depois.
      await tx
        .update(whatsappCampaignMessages)
        .set({
          status: "failed",
          errorMessage: opts.errorMessage ?? "Falha reportada pelo canal",
          updatedAt: opts.eventAt,
        })
        .where(eq(whatsappCampaignMessages.id, currentMessage.id));
    } else {
      const currentRank = STATUS_RANK[currentMessage.status] ?? 0;
      const nextRank = STATUS_RANK[status] ?? 0;
      if (nextRank <= currentRank) return;

      await tx
        .update(whatsappCampaignMessages)
        .set({
          status,
          ...(status === "delivered" ? { deliveredAt: opts.eventAt } : {}),
          ...(status === "read" ? { readAt: opts.eventAt } : {}),
          updatedAt: opts.eventAt,
        })
        .where(eq(whatsappCampaignMessages.id, currentMessage.id));
    }

    const statusCounts = await tx
      .select({ status: whatsappCampaignMessages.status, count: count() })
      .from(whatsappCampaignMessages)
      .where(eq(whatsappCampaignMessages.campaignId, currentMessage.campaignId))
      .groupBy(whatsappCampaignMessages.status);
    const countByStatus = Object.fromEntries(
      statusCounts.map((row) => [row.status, Number(row.count)]),
    );

    await tx
      .update(whatsappCampaigns)
      .set({
        scheduledMessages: countByStatus.scheduled ?? 0,
        sentMessages:
          (countByStatus.sent ?? 0) +
          (countByStatus.delivered ?? 0) +
          (countByStatus.read ?? 0),
        failedMessages: countByStatus.failed ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(whatsappCampaigns.id, currentMessage.campaignId));
  });
}

async function findCampaignMessageByDirectMatch(
  waMessageId: string,
): Promise<typeof whatsappCampaignMessages.$inferSelect | undefined> {
  const [msg] = await db
    .select()
    .from(whatsappCampaignMessages)
    .where(eq(whatsappCampaignMessages.messageId, waMessageId))
    .limit(1);
  return msg;
}

async function findCampaignMessageByFallbackFk(
  waMessageId: string,
): Promise<typeof whatsappCampaignMessages.$inferSelect | undefined> {
  const [wm] = await db
    .select({ campaignMessageId: whatsappMessages.campaignMessageId })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.waMessageId, waMessageId))
    .limit(1);
  if (!wm?.campaignMessageId) return undefined;

  const [msg] = await db
    .select()
    .from(whatsappCampaignMessages)
    .where(eq(whatsappCampaignMessages.id, wm.campaignMessageId))
    .limit(1);
  return msg;
}
