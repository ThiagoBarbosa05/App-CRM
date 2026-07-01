import { db } from "server/db";
import { campaigns, clients, calls, whatsappTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendTemplateMessage, sendTextMessage } from "../integrations/whatsapp";
import { normalizePhoneE164 } from "@shared/phone";

async function setCallWaStatus(
  callId: string,
  status: "enviado" | "falhou",
) {
  await db
    .update(calls)
    .set({ waMessageStatus: status })
    .where(eq(calls.id, callId));
}

export async function sendPostCallMessage(
  campaignId: string,
  clientId: string | null,
  decision: "sim" | "nao" | "sem_resposta",
  callId: string,
): Promise<void> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign?.waEnabled) return;

  const triggerDecision = campaign.waTriggerDecision;
  if (
    triggerDecision &&
    triggerDecision !== "qualquer" &&
    triggerDecision !== decision
  ) {
    return;
  }

  if (!clientId) {
    console.warn("[WaPostCall] clientId ausente, ignorando");
    return;
  }

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));

    if (!client?.phone) {
      console.warn(`[WaPostCall] Telefone não encontrado para cliente ${clientId}`);
      await setCallWaStatus(callId, "falhou");
      return;
    }

    const phoneE164 = normalizePhoneE164(client.phone);
    if (!phoneE164) {
      console.warn(`[WaPostCall] Telefone inválido: ${client.phone}`);
      await setCallWaStatus(callId, "falhou");
      return;
    }

    if (campaign.waTemplateId) {
      const [template] = await db
        .select()
        .from(whatsappTemplates)
        .where(eq(whatsappTemplates.id, campaign.waTemplateId));

      if (!template) {
        console.warn(`[WaPostCall] Template ${campaign.waTemplateId} não encontrado`);
        await setCallWaStatus(callId, "falhou");
        return;
      }

      const bodyParams = Array.isArray(template.bodyParams)
        ? template.bodyParams.map((param: unknown) => {
            const key = typeof param === "string" ? param : String(param);
            const value = key === "nome" ? client.name : key;
            return { type: "text", text: value };
          })
        : [];

      const components =
        bodyParams.length > 0
          ? [{ type: "body", parameters: bodyParams }]
          : undefined;

      await sendTemplateMessage(phoneE164, template.name, template.languageCode, components);
    } else if (campaign.umblerMessageText) {
      await sendTextMessage(phoneE164, campaign.umblerMessageText);
    } else {
      console.warn("[WaPostCall] Nenhum template ou mensagem configurado na campanha");
      await setCallWaStatus(callId, "falhou");
      return;
    }

    await setCallWaStatus(callId, "enviado");
    console.log(`[WaPostCall] Mensagem enviada com sucesso para ${client.phone}`);
  } catch (err) {
    console.error("[WaPostCall] Erro:", err);
    await setCallWaStatus(callId, "falhou");
    throw err;
  }
}
