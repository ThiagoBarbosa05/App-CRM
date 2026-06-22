import { Router, Request, Response } from "express";
import { getChannelByEvolutionInstance, updateConnectionStatus } from "../services/whatsapp-channels.service";
import { saveInboundMessage } from "../services/whatsapp-conversations.service";
import { publishSseEvent } from "../lib/sse-hub";
import { jidToPhone, isGroupJid } from "../integrations/evolution";

const router = Router();

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

// ── messages.upsert ────────────────────────────────────────────────────────────

async function handleMessagesUpsert(instanceName: string, data: unknown) {
  const msg = data as {
    key: { remoteJid: string; fromMe: boolean; id: string };
    message?: Record<string, unknown>;
    messageType?: string;
    messageTimestamp?: number;
    pushName?: string;
  };

  const jid = msg.key?.remoteJid;
  if (!jid || isGroupJid(jid)) return;

  const waMessageId = msg.key.id;
  const fromMe = msg.key.fromMe === true;
  const phone = jidToPhone(jid);

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) {
    console.warn(`[Evolution Webhook] Instância "${instanceName}" não encontrada no banco`);
    return;
  }

  const msgContent = msg.message ?? {};
  const text =
    (msgContent.conversation as string | undefined) ??
    ((msgContent.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined) ??
    null;

  // Tipo de mensagem
  let type = "text";
  if (msgContent.imageMessage) type = "image";
  else if (msgContent.audioMessage || msgContent.pttMessage) type = "audio";
  else if (msgContent.videoMessage) type = "video";
  else if (msgContent.documentMessage) type = "document";
  else if (msgContent.stickerMessage) type = "sticker";

  const timestamp = msg.messageTimestamp
    ? String(msg.messageTimestamp)
    : undefined;

  await saveInboundMessage({
    phone,
    content: text,
    type,
    waMessageId,
    timestamp,
    channelId: channel.id,
    rawPayload: msg as Record<string, unknown>,
    // Para mensagens enviadas do celular do vendedor (fromMe:true), salva como outbound
    // O saveInboundMessage trata direction internamente com base em fromMe
    _fromMe: fromMe,
  }).catch((err) =>
    console.error("[Evolution Webhook] Erro ao salvar mensagem:", err),
  );
}

// ── messages.update ────────────────────────────────────────────────────────────

async function handleMessagesUpdate(data: unknown) {
  const updates = Array.isArray(data) ? data : [data];
  for (const update of updates) {
    const u = update as { key?: { id?: string }; update?: { status?: string } };
    const waMessageId = u.key?.id;
    const status = u.update?.status?.toLowerCase();
    if (!waMessageId || !status) continue;

    // Mapeia status da Evolution para os valores do schema
    const statusMap: Record<string, string> = {
      delivery_ack: "delivered",
      read: "read",
      played: "read",
      error: "failed",
    };
    const mapped = statusMap[status] ?? status;
    if (!["sent", "delivered", "read", "failed"].includes(mapped)) continue;

    const { db } = await import("../db");
    const { whatsappMessages } = await import("../../shared/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .update(whatsappMessages)
      .set({ status: mapped as "sent" | "delivered" | "read" | "failed" })
      .where(eq(whatsappMessages.waMessageId, waMessageId))
      .catch((err) => console.error("[Evolution Webhook] Erro ao atualizar status:", err));
  }
}

// ── connection.update ──────────────────────────────────────────────────────────

async function handleConnectionUpdate(instanceName: string, data: unknown) {
  const update = data as { state?: string };
  const state = update.state ?? "disconnected";

  const stateMap: Record<string, string> = {
    open: "connected",
    connecting: "connecting",
    close: "disconnected",
    closed: "disconnected",
  };
  const connectionStatus = stateMap[state] ?? state;

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;

  await updateConnectionStatus(channel.id, connectionStatus);

  // Notifica o vendedor dono do canal via SSE
  if (channel.userId) {
    publishSseEvent("evolution_connection_update", { instanceName, connectionStatus }, channel.userId);
  }
}

// ── qrcode.updated ─────────────────────────────────────────────────────────────

async function handleQrcodeUpdated(instanceName: string, data: unknown) {
  const qrData = data as { qrcode?: { base64?: string; code?: string } };
  const base64 = qrData.qrcode?.base64 ?? null;
  const code = qrData.qrcode?.code ?? null;

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) return;

  await updateConnectionStatus(channel.id, "qr");

  // Empurra QR para a tela do vendedor via SSE
  if (channel.userId) {
    publishSseEvent("evolution_qr_updated", { instanceName, base64, code }, channel.userId);
  }
}

export default router;
