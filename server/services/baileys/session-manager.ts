import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  type WASocket,
  type WAMessage,
  type WAMessageUpdate,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { useNeonAuthState, getInstancesWithCreds, deleteInstanceCreds } from "./db-auth-state.js";
import { normalizeToJid } from "./jid.js";
import {
  handleConnectionUpdate,
  handleQrcodeUpdated,
  handleMessagesUpsert,
  handleMessagesUpdate,
} from "../whatsapp-baileys-events.service.js";
import { pool } from "../../db.js";
import { uploadWhatsappMedia } from "../../lib/r2.js";

// Baileys roda DENTRO do processo do CRM. Os eventos são entregues chamando
// diretamente os handlers do service (sem webhook HTTP).

interface SessionInfo {
  socket: WASocket;
  instanceId: string;
  status: "connecting" | "connected" | "disconnected" | "qr";
  qrBase64: string | null;
  qrCode: string | null;
}

const sessions = new Map<string, SessionInfo>();

// Callbacks aguardando o próximo QR de uma instância
const qrWaiters = new Map<string, Array<(qr: { code: string; base64: string | null }) => void>>();

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

function tsToNumber(ts: unknown): number | undefined {
  if (ts == null) return undefined;
  if (typeof ts === "number") return ts;
  if (typeof ts === "object" && typeof (ts as { toNumber?: () => number }).toNumber === "function") {
    return (ts as { toNumber: () => number }).toNumber();
  }
  const n = Number(ts);
  return Number.isNaN(n) ? undefined : n;
}

// Serializa apenas os campos relevantes da mensagem, sem Buffers/Uint8Arrays
function serializeMsgContent(msg: WAMessage): Record<string, unknown> {
  const m = msg.message;
  if (!m) return {};
  const out: Record<string, unknown> = {};
  if (m.conversation) out.conversation = m.conversation;
  if (m.extendedTextMessage?.text) out.extendedTextMessage = { text: m.extendedTextMessage.text };
  if (m.imageMessage) out.imageMessage = { caption: m.imageMessage.caption ?? null, mimetype: m.imageMessage.mimetype };
  if (m.audioMessage) {
    // Notas de voz (PTT) chegam como audioMessage com ptt=true no Baileys 7
    if (m.audioMessage.ptt) out.pttMessage = { mimetype: m.audioMessage.mimetype, seconds: m.audioMessage.seconds };
    else out.audioMessage = { mimetype: m.audioMessage.mimetype, seconds: m.audioMessage.seconds };
  }
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

// Mapeia o enum numérico do Baileys (proto.WebMessageInfo.Status) para string
const BAILEYS_STATUS: Record<number, string> = {
  0: "error",
  1: "pending",
  2: "server_ack",
  3: "delivery_ack",
  4: "read",
  5: "played",
};

function mapBaileysStatus(status: number | string | null | undefined): string {
  if (typeof status === "number") return BAILEYS_STATUS[status] ?? "pending";
  return String(status ?? "pending").toLowerCase();
}

async function tryDownloadMedia(
  sock: WASocket,
  msg: WAMessage,
  mimetype: string,
): Promise<{ storageKey: string; size: number } | null> {
  try {
    const buffer = await downloadMediaMessage(msg, "buffer", {}, {
      logger: makeLogger() as NonNullable<Parameters<typeof downloadMediaMessage>[3]>["logger"],
      reuploadRequest: sock.updateMediaMessage,
    });
    if (!buffer || (buffer as Buffer).length === 0) return null;
    const buf = buffer as Buffer;
    const storageKey = await uploadWhatsappMedia(buf, mimetype);
    return { storageKey, size: buf.length };
  } catch (err) {
    console.error("[Baileys] Falha ao baixar mídia — seguindo sem mídia:", err);
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
      // Gera o PNG base64 e empurra para a UI via SSE (mesmo shape do payload antigo)
      let base64: string | null = null;
      try {
        const buffer = await QRCode.toBuffer(qr, { type: "png", width: 300 });
        base64 = `data:image/png;base64,${buffer.toString("base64")}`;
      } catch {
        // best-effort — a UI também recebe o qrCode raw string via SSE
      }
      session.qrBase64 = base64;
      await handleQrcodeUpdated(instanceName, { qrcode: { base64, code: qr } }).catch(() => {});

      // Notifica quem estava aguardando o QR via waitForQr()
      const waiters = qrWaiters.get(instanceName) ?? [];
      qrWaiters.delete(instanceName);
      for (const resolve of waiters) resolve({ code: qr, base64 });
      return;
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrBase64 = null;
      session.qrCode = null;
      console.log(`[Baileys] Instância ${instanceName}: conectada.`);
      await handleConnectionUpdate(instanceName, { state: "open" }).catch(() => {});
    } else if (connection === "close") {
      session.status = "disconnected";
      await handleConnectionUpdate(instanceName, { state: "close" }).catch(() => {});

      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log(`[Baileys] Instância ${instanceName}: deslogada — removendo credenciais.`);
        sessions.delete(instanceName);
        await deleteInstanceCreds(pool, instanceName).catch(() => {});
      } else {
        console.log(`[Baileys] Instância ${instanceName}: reconectando (reason=${reason})...`);
        setTimeout(() => createSocket(instanceName).catch(console.error), 3_000);
      }
    } else if (connection === "connecting") {
      session.status = "connecting";
      await handleConnectionUpdate(instanceName, { state: "connecting" }).catch(() => {});
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
        messageTimestamp: tsToNumber(msg.messageTimestamp),
        pushName: msg.pushName ?? null,
      };
      if (baileysMedia) payload._baileysMedia = baileysMedia;

      await handleMessagesUpsert(instanceName, payload).catch(console.error);
    }
  });

  sock.ev.on("messages.update", async (updates: WAMessageUpdate[]) => {
    const mapped = updates.map((u) => ({
      key: u.key,
      update: { status: mapBaileysStatus(u.update?.status as number | undefined) },
    }));
    await handleMessagesUpdate(mapped).catch(console.error);
  });
}

/**
 * Aguarda até timeoutMs pelo próximo QR da instância.
 * Se a instância já tiver um QR em memória, retorna imediatamente.
 * Retorna null se expirar o tempo (sessão pode ter reconectado sem QR).
 */
export function waitForQr(
  instanceName: string,
  timeoutMs = 30_000,
): Promise<{ code: string; base64: string | null } | null> {
  const s = sessions.get(instanceName);
  if (s?.qrCode) return Promise.resolve({ code: s.qrCode, base64: s.qrBase64 });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const list = qrWaiters.get(instanceName);
      if (list) {
        const idx = list.indexOf(wrappedResolve);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) qrWaiters.delete(instanceName);
      }
      resolve(null);
    }, timeoutMs);

    const wrappedResolve = (qr: { code: string; base64: string | null }) => {
      clearTimeout(timer);
      resolve(qr);
    };

    if (!qrWaiters.has(instanceName)) qrWaiters.set(instanceName, []);
    qrWaiters.get(instanceName)!.push(wrappedResolve);
  });
}

// ── API pública ────────────────────────────────────────────────────────────────

export async function initSessionManager(): Promise<void> {
  const instances = await getInstancesWithCreds(pool);
  console.log(`[Baileys] Rehidratando ${instances.length} sessão(ões)...`);
  for (const name of instances) {
    await createSocket(name).catch((err) =>
      console.error(`[Baileys] Erro ao rehidratar "${name}":`, err),
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
    console.error(`[Baileys] Erro ao criar "${instanceName}":`, err),
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
  if (!s) {
    // Mesmo sem sessão ativa em memória, limpa credenciais persistidas
    await deleteInstanceCreds(pool, instanceName).catch(() => {});
    return;
  }
  try { await s.socket?.logout(); } catch { /* ignore */ }
  sessions.delete(instanceName);
  await deleteInstanceCreds(pool, instanceName);
}

export async function destroyInstance(instanceName: string): Promise<void> {
  await logoutInstance(instanceName);
}

export async function sendText(
  instanceName: string,
  to: string,
  text: string,
  options: { delay?: number; quotedMsgId?: string } = {},
): Promise<{ key: { remoteJid: string; fromMe: boolean; id: string }; status: string }> {
  const s = sessions.get(instanceName);
  if (!s?.socket) throw new Error(`Instância "${instanceName}" não encontrada ou desconectada`);
  const jid = normalizeToJid(to);

  const sendOpts = buildQuoted(jid, options.quotedMsgId);
  const result = await s.socket.sendMessage(jid, { text }, sendOpts);
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

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video",
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string; delay?: number },
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

// Constrói o objeto `quoted` mínimo para citar uma mensagem ao responder.
// Best-effort: se não houver id, não cita.
function buildQuoted(jid: string, quotedMsgId?: string): { quoted: WAMessage } | undefined {
  if (!quotedMsgId) return undefined;
  return {
    quoted: {
      key: { remoteJid: jid, fromMe: false, id: quotedMsgId },
      message: { conversation: "" },
    } as WAMessage,
  };
}
