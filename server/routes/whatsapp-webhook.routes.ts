import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { whatsappCampaignMessages, whatsappMessages } from "@shared/schema";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";
import { handleIncomingMessage as runBotEngine, handleFlowResponse } from "../services/whatsapp-bot-engine.service";
import { saveInboundMessage } from "../services/whatsapp-conversations.service";
import { getChannelByPhoneNumberId } from "../services/whatsapp-channels.service";

const router = Router();

// Ordem das transições de status (não permite regredir: read não volta a delivered).
const STATUS_RANK: Record<string, number> = {
  scheduled: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

// GET — verificação inicial do webhook pelo Meta
router.get("/webhook", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const raw = await getWhatsappSettingsRaw();
  const verifyToken = raw["wa_webhook_verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST — receber notificações de status e mensagens
router.post("/webhook", (req: Request, res: Response) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(404);
    return;
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      for (const status of value.statuses ?? []) {
        handleMessageStatus(status).catch((err) =>
          console.error("[WA Webhook] Erro ao processar status:", err),
        );
      }

      for (const message of value.messages ?? []) {
        handleIncomingMessage(message, value.metadata).catch((err) =>
          console.error("[WA Webhook] Erro ao processar mensagem:", err),
        );
      }
    }
  }

  res.sendStatus(200);
});

async function handleMessageStatus(status: {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  timestamp: string;
  errors?: Array<{ title?: string; message?: string; code?: number }>;
}) {
  console.log(`[WA Webhook] Mensagem ${status.id} → ${status.status}`);

  const now = new Date();

  // 1. Mensagem de campanha (umbler_campaign_messages.message_id = waMessageId)
  await updateCampaignMessageStatus(status, now).catch((err) =>
    console.error("[WA Webhook] Erro ao atualizar status de campanha:", err),
  );

  // 2. Mensagem de conversa (whatsapp_messages.wa_message_id = waMessageId)
  await db
    .update(whatsappMessages)
    .set({ status: status.status })
    .where(eq(whatsappMessages.waMessageId, status.id))
    .catch((err) =>
      console.error("[WA Webhook] Erro ao atualizar status de conversa:", err),
    );
}

async function updateCampaignMessageStatus(
  status: {
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    errors?: Array<{ title?: string; message?: string; code?: number }>;
  },
  now: Date,
): Promise<void> {
  const [msg] = await db
    .select()
    .from(whatsappCampaignMessages)
    .where(eq(whatsappCampaignMessages.messageId, status.id))
    .limit(1);

  if (!msg) return;

  // Estados terminais (failed/cancelled) não são sobrescritos por progresso.
  if (msg.status === "failed" || msg.status === "cancelled") return;

  if (status.status === "failed") {
    const err = status.errors?.[0];
    const errorMessage =
      err?.message || err?.title || "Falha reportada pela Meta";
    await db
      .update(whatsappCampaignMessages)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return;
  }

  // Só avança para frente (sent → delivered → read), nunca regride.
  const currentRank = STATUS_RANK[msg.status] ?? 0;
  const nextRank = STATUS_RANK[status.status] ?? 0;
  if (nextRank <= currentRank) return;

  await db
    .update(whatsappCampaignMessages)
    .set({
      status: status.status,
      ...(status.status === "delivered" ? { deliveredAt: now } : {}),
      ...(status.status === "read" ? { readAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(whatsappCampaignMessages.id, msg.id));
}

type IncomingMessage = {
  from: string;
  type: string;
  id: string;
  timestamp?: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; sha256?: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  interactive?: { type: string; nfm_reply?: { response_json: string; name: string; body: string } };
};

async function handleIncomingMessage(
  message: IncomingMessage,
  metadata: {
    phone_number_id: string;
    display_phone_number: string;
  },
) {
  const text = message.text?.body ?? "";
  const mediaObj = message.image ?? message.audio ?? message.video ?? message.document ?? message.sticker;

  console.log(
    `[WA Webhook] Mensagem recebida de ${message.from} (${metadata.display_phone_number}): ${text || `[${message.type}]`}`,
  );

  const channel = await getChannelByPhoneNumberId(metadata.phone_number_id).catch(() => null);

  await saveInboundMessage({
    phone: message.from,
    content: text || null,
    type: message.type,
    waMessageId: message.id,
    timestamp: message.timestamp,
    caption: (message.image?.caption ?? message.video?.caption ?? message.document?.caption) || undefined,
    rawPayload: message,
    channelId: channel?.id ?? null,
    mediaData: mediaObj
      ? {
          whatsappMediaId: mediaObj.id,
          mimeType: mediaObj.mime_type,
          filename: message.document?.filename,
        }
      : undefined,
  }).catch((err) => console.error("[WA Webhook] Erro ao salvar mensagem:", err));

  if (message.type === "text" && text) {
    await runBotEngine(message.from, text);
  }

  if (message.type === "interactive" && message.interactive?.type === "nfm_reply") {
    const nfmReply = message.interactive.nfm_reply;
    if (nfmReply?.response_json) {
      try {
        const responseJson = JSON.parse(nfmReply.response_json) as Record<string, unknown>;
        await handleFlowResponse(message.from, responseJson);
      } catch (err) {
        console.error("[WA Webhook] Erro ao processar resposta de Flow:", err);
      }
    }
  }
}

export default router;
