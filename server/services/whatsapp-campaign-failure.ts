import { db } from "server/db";
import {
  whatsappCampaigns,
  whatsappCampaignMessages,
  whatsappCampaignImpacts,
} from "@shared/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import {
  encodeCampaignMessageError,
  type WhatsappErrorCode,
} from "@shared/whatsapp-error-codes";

/**
 * Encerra uma campanha que falhou de forma estrutural.
 *
 * Existe porque o dispatcher só logava a exceção: canal desconectado, bot
 * excluído ou credencial faltando deixavam a campanha em `in_progress` para
 * sempre, refazendo a mesma falha a cada tick, sem nada visível na tela. Agora
 * a campanha vai para `failed` e cada mensagem que ainda estava `scheduled`
 * recebe o motivo, que a tela de detalhes traduz para o usuário.
 *
 * As reservas de dedupe das mensagens afetadas são liberadas — sem isso, um
 * "Reenviar falhas" posterior seria bloqueado pela própria reserva.
 *
 * Idempotente: se a campanha já está num status terminal, não faz nada.
 */
export async function failCampaign(
  campaignId: string,
  code: WhatsappErrorCode,
  detail?: string,
): Promise<boolean> {
  const errorMessage = encodeCampaignMessageError({ code, detail });

  return db.transaction(async (tx) => {
    // O UPDATE condicionado a `in_progress` também é o lock lógico: se outra
    // instância (ou o finalize) já moveu a campanha, nenhuma linha é afetada
    // e saímos sem tocar nas mensagens.
    const updated = await tx
      .update(whatsappCampaigns)
      .set({
        status: "failed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(whatsappCampaigns.id, campaignId),
          eq(whatsappCampaigns.status, "in_progress"),
        ),
      )
      .returning({ id: whatsappCampaigns.id });

    if (updated.length === 0) return false;

    const stranded = await tx
      .update(whatsappCampaignMessages)
      .set({ status: "failed", errorMessage, updatedAt: new Date() })
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "scheduled"),
        ),
      )
      .returning({ id: whatsappCampaignMessages.id });

    if (stranded.length > 0) {
      await tx
        .update(whatsappCampaignImpacts)
        .set({ status: "released", updatedAt: new Date() })
        .where(
          inArray(
            whatsappCampaignImpacts.campaignMessageId,
            stranded.map((row) => row.id),
          ),
        );
    }

    // Recontagem em vez de `stranded.length`: mensagens que já tinham falhado
    // antes deste encerramento também contam para o total exibido.
    const [{ failed }] = await tx
      .select({ failed: count() })
      .from(whatsappCampaignMessages)
      .where(
        and(
          eq(whatsappCampaignMessages.campaignId, campaignId),
          eq(whatsappCampaignMessages.status, "failed"),
        ),
      );

    await tx
      .update(whatsappCampaigns)
      .set({ failedMessages: Number(failed), updatedAt: new Date() })
      .where(eq(whatsappCampaigns.id, campaignId));

    return true;
  });
}
