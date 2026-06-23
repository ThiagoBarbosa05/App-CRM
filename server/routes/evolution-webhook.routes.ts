import { Router, Request, Response } from "express";
import {
  handleMessagesUpsert,
  handleMessagesUpdate,
  handleConnectionUpdate,
  handleQrcodeUpdated,
} from "../services/whatsapp-baileys-events.service";

const router = Router();

// DEPRECADO: o Baileys agora roda in-process e chama os handlers diretamente.
// Esta rota permanece como wrapper fino apenas por compatibilidade (ex.: caso
// algum provedor externo ainda poste eventos no formato Evolution).
// POST /evolution/webhook — recebe todos os eventos de todas as instâncias
router.post("/webhook", (req: Request, res: Response) => {
  res.sendStatus(200);
  handleEvent(req.body).catch((err) =>
    console.error("[Evolution Webhook] Erro ao processar evento:", err),
  );
});

async function handleEvent(body: unknown) {
  const payload = body as Record<string, unknown>;
  const event = payload.event as string | undefined;
  // A Evolution envia o nome da instância em `instance` (string) ou `instance.instanceName`
  const instanceName =
    typeof payload.instance === "string"
      ? payload.instance
      : (payload.instance as Record<string, string> | undefined)?.instanceName;

  if (!event || !instanceName) return;

  console.log(`[Evolution Webhook] event=${event} instance=${instanceName}`);

  switch (event) {
    case "messages.upsert":
      await handleMessagesUpsert(instanceName, payload.data as unknown);
      break;
    case "messages.update":
      await handleMessagesUpdate(payload.data as unknown);
      break;
    case "connection.update":
      await handleConnectionUpdate(instanceName, payload.data as unknown);
      break;
    case "qrcode.updated":
      await handleQrcodeUpdated(instanceName, payload.data as unknown);
      break;
    default:
      break;
  }
}

export default router;
