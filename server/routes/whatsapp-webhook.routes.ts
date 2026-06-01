import { Router, Request, Response } from "express";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";
import { handleIncomingMessage as runBotEngine } from "../services/whatsapp-bot-engine.service";

const router = Router();

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
  errors?: unknown[];
}) {
  console.log(`[WA Webhook] Mensagem ${status.id} → ${status.status}`);
  // TODO: atualizar waMessageStatus na tabela calls onde waMessageId = status.id
}

async function handleIncomingMessage(
  message: {
    from: string;
    type: string;
    text?: { body: string };
    id: string;
  },
  metadata: {
    phone_number_id: string;
    display_phone_number: string;
  },
) {
  const text = message.text?.body ?? "";
  console.log(
    `[WA Webhook] Mensagem recebida de ${message.from} (${metadata.display_phone_number}): ${text || `[${message.type}]`}`,
  );

  if (message.type === "text" && text) {
    await runBotEngine(message.from, text);
  }
}

export default router;
