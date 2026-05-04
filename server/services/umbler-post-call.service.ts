import { db } from "server/db";
import { campaigns, clients, calls } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  getContactByPhone,
  createChat,
  sendMessage,
  startBirthdayBot,
} from "../integrations/umbler";
import { formatPhoneToDigits } from "../lib/format-phone";

async function setCallUmblerStatus(
  callId: string,
  status: "enviado" | "falhou",
) {
  await db
    .update(calls)
    .set({ umblerMessageStatus: status })
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

  if (!campaign || !campaign.umblerEnabled) return;

  const triggerDecision = campaign.umblerTriggerDecision;
  if (
    triggerDecision &&
    triggerDecision !== "qualquer" &&
    triggerDecision !== decision
  ) {
    return;
  }

  if (!clientId) {
    console.warn("[UmblerPostCall] clientId ausente, ignorando");
    return;
  }

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));

    if (!client?.phone) {
      console.warn(`[UmblerPostCall] Telefone não encontrado para cliente ${clientId}`);
      await setCallUmblerStatus(callId, "falhou");
      return;
    }

    const phoneE164 = formatPhoneToDigits(client.phone);
    if (!phoneE164) {
      console.warn(`[UmblerPostCall] Telefone inválido: ${client.phone}`);
      await setCallUmblerStatus(callId, "falhou");
      return;
    }

    const contact = await getContactByPhone(phoneE164);
    if (!contact) {
      console.warn(`[UmblerPostCall] Contato não encontrado no Umbler para ${phoneE164}`);
      await setCallUmblerStatus(callId, "falhou");
      return;
    }

    if (!campaign.umblerChannelId) {
      console.warn("[UmblerPostCall] umblerChannelId não configurado");
      await setCallUmblerStatus(callId, "falhou");
      return;
    }

    const chat = await createChat({
      contactId: contact.id,
      channelId: campaign.umblerChannelId,
    });

    if (!chat?.id) {
      console.warn("[UmblerPostCall] Falha ao criar chat no Umbler");
      await setCallUmblerStatus(callId, "falhou");
      return;
    }

    if (campaign.umblerMessageText) {
      await sendMessage({ chatId: chat.id, message: campaign.umblerMessageText });
    }

    if (campaign.umblerBotId && campaign.umblerBotTriggerName) {
      await startBirthdayBot({
        chatId: chat.id,
        botId: campaign.umblerBotId,
        triggerName: campaign.umblerBotTriggerName,
      });
    }

    await setCallUmblerStatus(callId, "enviado");
    console.log(`[UmblerPostCall] Mensagem enviada com sucesso para ${client.phone}`);
  } catch (err) {
    console.error("[UmblerPostCall] Erro:", err);
    await setCallUmblerStatus(callId, "falhou");
    throw err;
  }
}
