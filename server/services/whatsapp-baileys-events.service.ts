import { getChannelByEvolutionInstance, updateConnectionStatus, updateChannel, getOwnChannelPhones } from "./whatsapp-channels.service";
import { saveInboundMessage } from "./whatsapp-conversations.service";
import { publishSseEvent } from "../lib/sse-hub";
import { jidToPhone, isIgnorableJid } from "./baileys/jid";
import { sendText as evoSendText } from "../integrations/evolution";
import { optOutClientByPhone, optInClientByPhone, matchOptKeyword } from "./whatsapp-opt-out.service";

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
  if (isIgnorableJid(jid)) return;

  const waMessageId = msg.key.id;
  const fromMe = msg.key.fromMe === true;
  const phone = jidToPhone(jid);

  const channel = await getChannelByEvolutionInstance(instanceName).catch(() => null);
  if (!channel) {
    console.warn(`[Baileys Events] Instância "${instanceName}" não encontrada no banco`);
    return;
  }

  // Ignora mensagens cujo remetente é um número próprio da empresa (ex.: o bot
  // dispara pelo canal Cloud API e a mensagem é espelhada de volta por este canal
  // Evolution). Sem isso, o número do bot apareceria como um contato novo.
  const ownPhones = await getOwnChannelPhones().catch(() => new Set<string>());
  if (ownPhones.has(phone.replace(/\D/g, ""))) {
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

  // Ignora mensagens de protocolo/sync (distribuição de chaves, app-state, etc.)
  // que o WhatsApp envia em rajada ao parear via QR — elas serializam vazias e
  // seriam salvas como "[text]" em massa.
  if (!text && type === "text" && !msg._baileysMedia) return;

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

  // Opt-out/opt-in de marketing via palavra-chave, mesmo mecanismo do webhook
  // da Cloud API (ver server/routes/whatsapp-webhook.routes.ts) — necessário
  // aqui também porque mensagens de canais QR Code (Evolution/Baileys) não
  // passam por aquele webhook.
  if (!fromMe && text) {
    const match = matchOptKeyword(text);
    if (match === "opt_out") {
      await optOutClientByPhone(phone, "keyword").catch((err) =>
        console.error("[Baileys Events] Erro ao processar opt-out:", err),
      );
      await evoSendText(
        instanceName,
        phone,
        "Você não receberá mais mensagens de marketing. Para voltar a receber, envie VOLTAR.",
      ).catch((err) => console.error("[Baileys Events] Erro ao enviar confirmação de opt-out:", err));
    } else if (match === "opt_in") {
      await optInClientByPhone(phone).catch((err) =>
        console.error("[Baileys Events] Erro ao processar opt-in:", err),
      );
      await evoSendText(
        instanceName,
        phone,
        "Pronto! Você voltará a receber nossas mensagens de marketing.",
      ).catch((err) => console.error("[Baileys Events] Erro ao enviar confirmação de opt-in:", err));
    }
  }
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
  const update = data as { state?: string; phone?: string };
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

  // Ao conectar via QR, salva o número real do WhatsApp no displayPhone (somente
  // se ainda não estiver preenchido — preserva valor definido manualmente).
  if (connectionStatus === "connected" && update.phone && !channel.displayPhone) {
    await updateChannel(channel.id, { displayPhone: `+${update.phone}` }).catch(() => {});
  }

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
