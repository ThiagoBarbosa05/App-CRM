import { eq } from "drizzle-orm";
import { db } from "../db";
import { whatsappCampaignMessages, whatsappMessages } from "@shared/schema";

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

  // Estado terminal: já falhou definitivamente ou a campanha foi cancelada — nenhum
  // evento de status posterior deve reabrir/alterar o registro.
  if (msg.status === "failed" || msg.status === "cancelled") return;

  if (status === "failed") {
    // NÃO chama releaseImpact aqui. A mensagem efetivamente SAIU (foi enviada e
    // depois falhou na entrega, reportado pelo canal via webhook/evento) — é
    // diferente de uma falha de ENVIO (ver handleSendFailure em
    // whatsapp-campaign.service.ts, que sim libera o impact porque a mensagem
    // nunca saiu). Liberar o impact aqui reabriria a janela de dedupe para um
    // conteúdo que já foi de fato entregue ao destinatário (ainda que com erro
    // de entrega reportado depois) — deixar reserved/sent como está preserva a
    // proteção contra reenvio duplicado do mesmo conteúdo.
    await db
      .update(whatsappCampaignMessages)
      .set({
        status: "failed",
        errorMessage: opts.errorMessage ?? "Falha reportada pelo canal",
        updatedAt: opts.eventAt,
      })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return;
  }

  const currentRank = STATUS_RANK[msg.status] ?? 0;
  const nextRank = STATUS_RANK[status] ?? 0;
  if (nextRank <= currentRank) return;

  await db
    .update(whatsappCampaignMessages)
    .set({
      status,
      ...(status === "delivered" ? { deliveredAt: opts.eventAt } : {}),
      ...(status === "read" ? { readAt: opts.eventAt } : {}),
      updatedAt: opts.eventAt,
    })
    .where(eq(whatsappCampaignMessages.id, msg.id));
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
