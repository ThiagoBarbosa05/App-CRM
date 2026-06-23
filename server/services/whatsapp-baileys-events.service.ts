import { getChannelByEvolutionInstance, updateConnectionStatus } from "./whatsapp-channels.service";
import { saveInboundMessage } from "./whatsapp-conversations.service";
import { publishSseEvent } from "../lib/sse-hub";
import { jidToPhone, isGroupJid } from "./baileys/jid";

// Eventos do Baileys são processados in-process (sem webhook HTTP). Os nomes de
// evento SSE e o shape dos payloads são preservados para não quebrar o frontend.

// ── messages.upsert ────────────────────────────────────────────────────────────

export async function handleMessagesUpsert(instanceName: string, data: unknown) {
  const msg = data as {
    key: { remoteJid: string; fromMe: boolean; id: string };
    message?: Record<string, unknown>;
    messageType?: string;
    messageTimestamp?: number;
    pushName?: string;
    _baileysMedia?: {
      storageKey: string;
      mimeType: string;
      filename: string | null;
      size: number;
    };
  };

  const jid = msg.key?.remoteJid;
  if (!jid || isGroupJid(jid)) return;

  const waMessageId = msg.key.id;
  const fromMe = msg.key.fromMe === true;
  const phone = jidToPhone(jid);

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) {
    console.warn(`[Baileys Events] Instância "${instanceName}" não encontrada no banco`);
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
    _fromMe: fromMe,
    mediaData: msg._baileysMedia
      ? {
          storageKey: msg._baileysMedia.storageKey,
          mimeType: msg._baileysMedia.mimeType,
          filename: msg._baileysMedia.filename ?? undefined,
          size: msg._baileysMedia.size,
        }
      : undefined,
  }).catch((err) =>
    console.error("[Baileys Events] Erro ao salvar mensagem:", err),
  );
}

// ── messages.update ────────────────────────────────────────────────────────────

export async function handleMessagesUpdate(data: unknown) {
  const updates = Array.isArray(data) ? data : [data];
  for (const update of updates) {
    const u = update as { key?: { id?: string }; update?: { status?: string } };
    const waMessageId = u.key?.id;
    const status = u.update?.status?.toLowerCase();
    if (!waMessageId || !status) continue;

    // Mapeia status do Baileys para os valores do schema
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
      .catch((err) => console.error("[Baileys Events] Erro ao atualizar status:", err));
  }
}

// ── connection.update ──────────────────────────────────────────────────────────

export async function handleConnectionUpdate(instanceName: string, data: unknown) {
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

export async function handleQrcodeUpdated(instanceName: string, data: unknown) {
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
