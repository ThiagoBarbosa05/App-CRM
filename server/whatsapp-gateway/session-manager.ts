import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  type WASocket,
  type WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";
import { useNeonAuthState, getInstancesWithCreds, deleteInstanceCreds } from "./db-auth-state.js";
import {
  sendConnectionUpdate,
  sendQrUpdated,
  sendMessagesUpsert,
  sendMessagesUpdate,
  mapBaileysStatus,
} from "./events-to-webhook.js";
import { uploadWhatsappMedia } from "../lib/r2.js";

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

interface SessionInfo {
  socket: WASocket;
  instanceId: string;
  status: "connecting" | "connected" | "disconnected" | "qr";
  qrBase64: string | null;
  qrCode: string | null;
}

const sessions = new Map<string, SessionInfo>();

// Logger mínimo compatível com pino — suprime logs verbosos do Baileys
function makeLogger() {
  const noop = () => {};
  return {
    level: "silent" as const,
    trace: noop,
    debug: noop,
    info: noop,
    warn: (...a: unknown[]) => console.warn("[Baileys]", ...a),
    error: (...a: unknown[]) => console.error("[Baileys]", ...a),
    fatal: (...a: unknown[]) => console.error("[Baileys FATAL]", ...a),
    // pino exige child() que retorna o mesmo tipo
    child: function () { return this; },
  };
}

// Serializa apenas os campos relevantes da mensagem, sem Buffers/Uint8Arrays
function serializeMsgContent(msg: WAMessage): Record<string, unknown> {
  const m = msg.message;
  if (!m) return {};
  const out: Record<string, unknown> = {};
  if (m.conversation) out.conversation = m.conversation;
  if (m.extendedTextMessage?.text) out.extendedTextMessage = { text: m.extendedTextMessage.text };
  if (m.imageMessage) out.imageMessage = { caption: m.imageMessage.caption ?? null, mimetype: m.imageMessage.mimetype };
  if (m.audioMessage) out.audioMessage = { mimetype: m.audioMessage.mimetype, seconds: m.audioMessage.seconds };
  if (m.pttMessage) out.pttMessage = { mimetype: m.pttMessage.mimetype, seconds: m.pttMessage.seconds };
  if (m.videoMessage) out.videoMessage = { caption: m.videoMessage.caption ?? null, mimetype: m.videoMessage.mimetype };
  if (m.documentMessage) out.documentMessage = {
    fileName: m.documentMessage.fileName,
    mimetype: m.documentMessage.mimetype,
    caption: m.documentMessage.caption ?? null,
  };
  if (m.stickerMessage) out.stickerMessage = { mimetype: m.stickerMessage.mimetype };
  if (m.reactionMessage) out.reactionMessage = { key: m.reactionMessage.key, text: m.reactionMessage.text };
  return out;
}

function detectMediaType(content: Record<string, unknown>): string | null {
  if (content.imageMessage) return (content.imageMessage as Record<string, unknown>).mimetype as string ?? "image/jpeg";
  if (content.audioMessage) return (content.audioMessage as Record<string, unknown>).mimetype as string ?? "audio/ogg";
  if (content.pttMessage) return (content.pttMessage as Record<string, unknown>).mimetype as string ?? "audio/ogg";
  if (content.videoMessage) return (content.videoMessage as Record<string, unknown>).mimetype as string ?? "video/mp4";
  if (content.documentMessage) return (content.documentMessage as Record<string, unknown>).mimetype as string ?? "application/octet-stream";
  if (content.stickerMessage) return (content.stickerMessage as Record<string, unknown>).mimetype as string ?? "image/webp";
  return null;
}

function detectFilename(content: Record<string, unknown>): string | null {
  const dm = content.documentMessage as Record<string, unknown> | undefined;
  return dm?.fileName as string ?? null;
}

async function tryDownloadMedia(
  sock: WASocket,
  msg: WAMessage,
  mimetype: string,
): Promise<{ storageKey: string; size: number } | null> {
  try {
    const buffer = await downloadMediaMessage(msg, "buffer", {}, {
      logger: makeLogger() as Parameters<typeof downloadMediaMessage>[3]["logger"],
      reuploadRequest: sock.updateMediaMessage,
    });
    if (!buffer || (buffer as Buffer).length === 0) return null;
    const buf = buffer as Buffer;
    const storageKey = await uploadWhatsappMedia(buf, mimetype);
    return { storageKey, size: buf.length };
  } catch (err) {
    console.error("[Gateway] Falha ao baixar mídia — seguindo sem mídia:", err);
    return null;
  }
}

async function createSocket(instanceName: string): Promise<void> {
  const { state, saveCreds } = await useNeonAuthState(pool, instanceName);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: makeLogger() as Parameters<typeof makeWASocket>[0]["logger"],
    browser: ["CRM", "Chrome", "10.0"],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
  });

  const existingId = sessions.get(instanceName)?.instanceId ?? crypto.randomUUID();
  sessions.set(instanceName, {
    socket: sock,
    instanceId: existingId,
    status: "connecting",
    qrBase64: null,
    qrCode: null,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: { connection?: string; qr?: string; lastDisconnect?: { error: unknown } }) => {
    const { connection, qr, lastDisconnect } = update;
    const session = sessions.get(instanceName);
    if (!session) return;

    if (qr) {
      session.status = "qr";
      session.qrCode = qr;
      await sendQrUpdated(instanceName, qr).catch(() => {});
      return;
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrBase64 = null;
      session.qrCode = null;
      console.log(`[Gateway] Instância ${instanceName}: conectada.`);
      await sendConnectionUpdate(instanceName, "open").catch(() => {});
    } else if (connection === "close") {
      session.status = "disconnected";
      await sendConnectionUpdate(instanceName, "close").catch(() => {});

      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log(`[Gateway] Instância ${instanceName}: deslogada — removendo credenciais.`);
        sessions.delete(instanceName);
        await deleteInstanceCreds(pool, instanceName).catch(() => {});
      } else {
        console.log(`[Gateway] Instância ${instanceName}: reconectando (reason=${reason})...`);
        setTimeout(() => createSocket(instanceName).catch(console.error), 3_000);
      }
    } else if (connection === "connecting") {
      session.status = "connecting";
      await sendConnectionUpdate(instanceName, "connecting").catch(() => {});
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: { messages: WAMessage[]; type: string }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      const jid = msg.key?.remoteJid ?? "";
      if (!jid || jid.endsWith("@g.us")) continue;

      const msgContent = serializeMsgContent(msg);
      const mimetype = detectMediaType(msgContent);
      const isMedia = !!mimetype && !msgContent.conversation && !msgContent.extendedTextMessage;

      let baileysMedia: { storageKey: string; mimeType: string; filename: string | null; size: number } | undefined;
      if (isMedia) {
        const uploaded = await tryDownloadMedia(sock, msg, mimetype);
        if (uploaded) {
          baileysMedia = {
            storageKey: uploaded.storageKey,
            mimeType: mimetype,
            filename: detectFilename(msgContent),
            size: uploaded.size,
          };
        }
      }

      const payload: Record<string, unknown> = {
        key: msg.key,
        message: msgContent,
        messageTimestamp: msg.messageTimestamp,
        pushName: msg.pushName ?? null,
      };
      if (baileysMedia) payload._baileysMedia = baileysMedia;

      await sendMessagesUpsert(instanceName, payload).catch(console.error);
    }
  });

  sock.ev.on("messages.update", async (updates: Array<{ key: WAMessage["key"]; update: { status?: number | string } }>) => {
    const mapped = updates.map((u) => ({
      key: u.key,
      update: { status: mapBaileysStatus(u.update?.status as number | undefined) },
    }));
    await sendMessagesUpdate(instanceName, mapped).catch(console.error);
  });
}

// ── API pública ────────────────────────────────────────────────────────────────

export async function initSessionManager(): Promise<void> {
  const instances = await getInstancesWithCreds(pool);
  console.log(`[Gateway] Rehidratando ${instances.length} sessão(ões)...`);
  for (const name of instances) {
    await createSocket(name).catch((err) =>
      console.error(`[Gateway] Erro ao rehidratar "${name}":`, err),
    );
  }
}

export function startInstance(instanceName: string): { instanceId: string; status: string } {
  if (sessions.has(instanceName)) {
    const s = sessions.get(instanceName)!;
    return { instanceId: s.instanceId, status: s.status };
  }
  const instanceId = crypto.randomUUID();
  // placeholder enquanto createSocket é assíncrono
  sessions.set(instanceName, {
    socket: null as unknown as WASocket,
    instanceId,
    status: "connecting",
    qrBase64: null,
    qrCode: null,
  });
  createSocket(instanceName).catch((err) =>
    console.error(`[Gateway] Erro ao criar "${instanceName}":`, err),
  );
  return { instanceId, status: "connecting" };
}

export function getQr(instanceName: string): { code: string; base64: string | null } | null {
  const s = sessions.get(instanceName);
  if (!s?.qrCode) return null;
  return { code: s.qrCode, base64: s.qrBase64 };
}

export function getConnectionState(instanceName: string): string {
  const s = sessions.get(instanceName);
  if (!s) return "close";
  const map: Record<string, string> = {
    connected: "open",
    connecting: "connecting",
    disconnected: "close",
    qr: "qr",
  };
  return map[s.status] ?? "close";
}

export async function logoutInstance(instanceName: string): Promise<void> {
  const s = sessions.get(instanceName);
  if (!s) return;
  try { await s.socket?.logout(); } catch { /* ignore */ }
  sessions.delete(instanceName);
  await deleteInstanceCreds(pool, instanceName);
}

export async function destroyInstance(instanceName: string): Promise<void> {
  await logoutInstance(instanceName);
}

// Normaliza número BR → JID WhatsApp
function normalizeToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withDdi = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `${withDdi}@s.whatsapp.net`;
}

export async function sendText(
  instanceName: string,
  to: string,
  text: string,
): Promise<{ key: { remoteJid: string; fromMe: boolean; id: string }; status: string }> {
  const s = sessions.get(instanceName);
  if (!s?.socket) throw new Error(`Instância "${instanceName}" não encontrada ou desconectada`);
  const result = await s.socket.sendMessage(normalizeToJid(to), { text });
  if (!result?.key) throw new Error("sendMessage não retornou key");
  return {
    key: {
      remoteJid: result.key.remoteJid ?? normalizeToJid(to),
      fromMe: result.key.fromMe ?? true,
      id: result.key.id ?? "",
    },
    status: "sent",
  };
}

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaType: string,
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string },
): Promise<{ key: { remoteJid: string; fromMe: boolean; id: string }; status: string }> {
  const s = sessions.get(instanceName);
  if (!s?.socket) throw new Error(`Instância "${instanceName}" não encontrada ou desconectada`);

  const jid = normalizeToJid(to);
  const mime = opts.mimetype ?? "application/octet-stream";

  // Resolve conteúdo: base64 data-URL, base64 raw, ou URL remota
  let media: Buffer | { url: string };
  if (opts.base64) {
    const match = opts.base64.match(/^data:[^;]+;base64,(.+)$/);
    media = Buffer.from(match ? match[1] : opts.base64, "base64");
  } else if (opts.url) {
    media = { url: opts.url };
  } else {
    throw new Error("Forneça base64 ou url para envio de mídia");
  }

  type SendContent = Parameters<WASocket["sendMessage"]>[1];
  let content: SendContent;

  if (mediaType === "image") {
    content = { image: media as Buffer, caption: opts.caption, mimetype: mime };
  } else if (mediaType === "video") {
    content = { video: media as Buffer, caption: opts.caption, mimetype: mime };
  } else if (mediaType === "audio") {
    content = { audio: media as Buffer, mimetype: mime, ptt: false };
  } else {
    content = { document: media as Buffer, fileName: opts.filename, mimetype: mime, caption: opts.caption };
  }

  const result = await s.socket.sendMessage(jid, content);
  if (!result?.key) throw new Error("sendMessage não retornou key");
  return {
    key: {
      remoteJid: result.key.remoteJid ?? jid,
      fromMe: result.key.fromMe ?? true,
      id: result.key.id ?? "",
    },
    status: "sent",
  };
}
