import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  type WASocket,
  type WAMessage,
  type WAMessageUpdate,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import QRCode from "qrcode";
import { useNeonAuthState, getInstancesWithCreds, deleteInstanceCreds } from "./db-auth-state.js";
import { tryAcquireInstanceLock, releaseInstanceLock } from "./instance-lock.js";
import { getDisconnectReasonLabel } from "./disconnect-reason.js";
import { normalizeToJid, jidToPhone, isIgnorableJid } from "./jid.js";
import {
  handleConnectionUpdate,
  handleQrcodeUpdated,
  handleMessagesUpsert,
  handleMessagesUpdate,
} from "../whatsapp-baileys-events.service.js";
import { pool } from "../../db.js";
import { uploadWhatsappMedia } from "../../lib/r2.js";
import { getChannelByEvolutionInstance, updateConnectionStatus } from "../whatsapp-channels.service.js";

// Baileys roda DENTRO do processo do CRM. Os eventos são entregues chamando
// diretamente os handlers do service (sem webhook HTTP).

// ── Comando de logout entre réplicas (Postgres LISTEN/NOTIFY) ───────────────────
//
// `logoutInstance` pode ser chamado numa réplica que não é dona do socket vivo
// (bem comum em Autoscale, sem sticky sessions). Sem propagação, apenas as
// credenciais no banco são apagadas — a réplica dona continua com o socket e o
// advisory lock vivos "órfãos", travando qualquer tentativa futura de conectar
// (nenhuma réplica consegue adquirir o lock). NOTIFY avisa todas as réplicas
// para encerrarem localmente a instância, caso a possuam.
const INSTANCE_CMD_CHANNEL = "baileys_instance_cmd";

const cmdListenPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
cmdListenPool.on("error", (err: Error) => {
  console.error("[Baileys cmd] Erro inesperado na conexão de listen/notify:", err);
});

let cmdListenClient: PoolClient | null = null;
let cmdListenClientPromise: Promise<PoolClient> | null = null;

async function getCmdListenClient(): Promise<PoolClient> {
  if (cmdListenClient) return cmdListenClient;
  if (!cmdListenClientPromise) {
    cmdListenClientPromise = (async () => {
      const client = await cmdListenPool.connect();
      await client.query(`LISTEN ${INSTANCE_CMD_CHANNEL}`);
      client.on("notification", (msg) => {
        if (msg.channel !== INSTANCE_CMD_CHANNEL || !msg.payload) return;
        try {
          const parsed = JSON.parse(msg.payload) as { instanceName?: string; action: string; [k: string]: unknown };
          if (parsed.action === "logout") {
            teardownLocalSession(parsed.instanceName!).catch(console.error);
          } else if (parsed.action === "send_text" || parsed.action === "send_media") {
            handleRemoteSendCommand(parsed as RemoteSendCommand).catch(console.error);
          } else if (parsed.action === "send_result") {
            handleSendResult(parsed as SendResultPayload);
          }
        } catch (err) {
          console.error("[Baileys cmd] Payload de comando inválido:", err);
        }
      });
      client.on("error", (err: Error) => {
        console.error("[Baileys cmd] Conexão de listen caiu, será reconectada na próxima publicação:", err);
        cmdListenClient = null;
        cmdListenClientPromise = null;
      });
      cmdListenClient = client;
      return client;
    })();
  }
  return cmdListenClientPromise;
}

// Garante que esta réplica está ouvindo comandos desde o boot.
getCmdListenClient().catch((err) =>
  console.error("[Baileys cmd] Falha ao iniciar LISTEN de comandos de instância:", err),
);

async function publishCmd(payload: Record<string, unknown>): Promise<void> {
  const client = await getCmdListenClient();
  await client.query("SELECT pg_notify($1, $2)", [INSTANCE_CMD_CHANNEL, JSON.stringify(payload)]);
}

function broadcastInstanceCommand(instanceName: string, action: string): void {
  publishCmd({ instanceName, action }).catch((err) =>
    console.error("[Baileys cmd] Falha ao propagar comando entre réplicas:", err),
  );
}

// Encerra a sessão desta instância NESTA réplica, se ela existir aqui: fecha o
// socket, libera o lock e remove do mapa local. Não mexe nas credenciais no
// banco (isso é feito centralmente por quem originou o logout).
async function teardownLocalSession(instanceName: string): Promise<void> {
  const s = sessions.get(instanceName);
  if (!s) return;
  try { s.socket?.end(undefined); } catch { /* ignore */ }
  if (s.lockClient) await releaseInstanceLock(instanceName, s.lockClient).catch(() => {});
  sessions.delete(instanceName);
}

interface SessionInfo {
  socket: WASocket;
  instanceId: string;
  status: "connecting" | "connected" | "disconnected" | "qr";
  qrBase64: string | null;
  qrCode: string | null;
  reconnectAttempts: number;
  // Advisory lock do Postgres que garante que só esta réplica mantém o
  // socket Baileys vivo para esta instância (evita conflito 440 entre
  // múltiplas réplicas do autoscale). null enquanto aguardando o lock.
  lockClient: PoolClient | null;
}

// Retry espaçado para instâncias cujo lock pertence a outra réplica —
// bem mais longo que o backoff normal de reconexão, pois aqui não houve
// disconnect: estamos apenas esperando a outra réplica soltar o canal.
const LOCK_RETRY_DELAY_MS = 30_000;
// Backoff fixo após perder a sessão para outra réplica (reason 440/conflict).
// Maior que o backoff genérico para não voltar a colidir imediatamente.
const CONFLICT_RETRY_DELAY_MS = 30_000;

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

// Resolve o JID real quando o WhatsApp usa endereçamento LID (@lid). O número
// dentro de um @lid NÃO é o telefone do contato — é um identificador de
// privacidade. Sem resolver, a conversa é criada com um número falso (ex:
// 155495012819150) que não casa com o cadastro do cliente, gerando duplicatas.
async function resolveRealJid(
  sock: WASocket,
  key: {
    remoteJid?: string | null;
    remoteJidAlt?: string | null;
    senderPn?: string | null;
    participantPn?: string | null;
  },
): Promise<string | null> {
  const jid = key.remoteJid ?? "";
  if (!jid.endsWith("@lid")) return jid;
  // 1) A própria key normalmente já traz a forma @s.whatsapp.net em remoteJidAlt
  //    (ou em senderPn/participantPn, dependendo da versão do Baileys)
  for (const alt of [key.remoteJidAlt, key.senderPn, key.participantPn]) {
    if (alt && alt.endsWith("@s.whatsapp.net")) return alt;
  }
  // 2) Fallback: store de mapeamento LID → PN do Baileys
  const lidMapping = (sock as unknown as {
    signalRepository?: { lidMapping?: { getPNForLID?: (lid: string) => Promise<string | null> } };
  }).signalRepository?.lidMapping;
  if (lidMapping?.getPNForLID) {
    const pn = await lidMapping.getPNForLID(jid).catch(() => null);
    if (pn) return pn;
  }
  // Sem telefone real, descartamos o evento: seguir com o número do @lid criaria
  // uma conversa com um "telefone" que não existe, invisível ao atendente e
  // impossível de conciliar com o cliente depois.
  return null;
}

async function createSocket(instanceName: string, explicitLock?: PoolClient | null): Promise<void> {
  const existing = sessions.get(instanceName);

  // Garante que só esta réplica mantém um socket Baileys vivo para esta
  // instância. Se esta réplica já detém o lock (reconexão da própria sessão —
  // ex.: restart 515 pós-pareamento, backoff genérico, ou um lock já
  // adquirido explicitamente por forceRestartInstance), reaproveita a mesma
  // conexão em vez de tentar adquirir de novo: uma segunda tentativa de
  // pg_try_advisory_lock pela MESMA réplica sempre falharia (o Postgres trata
  // cada conexão do pool como uma sessão distinta), fazendo a réplica "perder"
  // seu próprio lock e cair no retry de 30s achando que outra réplica é dona.
  let lockClient = explicitLock !== undefined ? explicitLock : existing?.lockClient ?? null;
  if (!lockClient) {
    lockClient = await tryAcquireInstanceLock(instanceName);
  }
  if (!lockClient) {
    sessions.set(instanceName, {
      socket: existing?.socket ?? (null as unknown as WASocket),
      instanceId: existing?.instanceId ?? crypto.randomUUID(),
      status: "disconnected",
      qrBase64: null,
      qrCode: null,
      reconnectAttempts: existing?.reconnectAttempts ?? 0,
      lockClient: null,
    });
    console.log(`[Baileys] Instância ${instanceName}: gerenciada por outra réplica — aguardando (${LOCK_RETRY_DELAY_MS}ms)...`);
    setTimeout(() => createSocket(instanceName).catch(console.error), LOCK_RETRY_DELAY_MS);
    return;
  }

  const { state, saveCreds } = await useNeonAuthState(pool, instanceName);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: makeLogger() as Parameters<typeof makeWASocket>[0]["logger"],
    // Usar browser padrão do Baileys (macOS Chrome) evita rejeição 515 por
    // client string inválida/muito antiga
    browser: Browsers.macOS("Chrome"),
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
  });

  sessions.set(instanceName, {
    socket: sock,
    instanceId: existing?.instanceId ?? crypto.randomUUID(),
    status: "connecting",
    qrBase64: null,
    qrCode: null,
    reconnectAttempts: existing?.reconnectAttempts ?? 0,
    lockClient,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: { connection?: string; qr?: string; lastDisconnect?: { error: unknown } }) => {
    const { connection, qr, lastDisconnect } = update;
    const session = sessions.get(instanceName);
    // Ignora eventos de um socket obsoleto: se um logout/reconexão explícito já
    // substituiu a sessão desta instância por uma nova (novo socket), um evento
    // tardio deste socket antigo não pode mais mutar o estado global — senão
    // apaga a sessão/credenciais recém-criadas (race condition).
    if (!session || session.socket !== sock) return;

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
      session.reconnectAttempts = 0;
      const meJid = state.creds.me?.id;
      const phone = meJid ? jidToPhone(meJid) : undefined;
      console.log(`[Baileys] Instância ${instanceName}: conectada.${phone ? ` (${phone})` : ""}`);
      await handleConnectionUpdate(instanceName, { state: "open", phone }).catch(() => {});
    } else if (connection === "close") {
      session.status = "disconnected";
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      // O restart automático pós-pareamento (515) não é uma queda real — não
      // entra no histórico de conexão exibido ao vendedor.
      await handleConnectionUpdate(instanceName, {
        state: "close",
        reasonCode: reason !== undefined ? String(reason) : undefined,
        reasonLabel: getDisconnectReasonLabel(reason),
        logEvent: reason !== DisconnectReason.restartRequired,
      }).catch(() => {});

      if (reason === DisconnectReason.loggedOut) {
        console.log(`[Baileys] Instância ${instanceName}: deslogada — removendo credenciais.`);
        if (session.lockClient) await releaseInstanceLock(instanceName, session.lockClient).catch(() => {});
        sessions.delete(instanceName);
        await deleteInstanceCreds(pool, instanceName).catch(() => {});
      } else if (reason === DisconnectReason.restartRequired) {
        // 515 é esperado logo após o pareamento por QR: o Baileys exige reiniciar
        // o socket uma vez. Reconecta imediatamente, sem contar como falha de backoff.
        // Mantém o lock: é a mesma réplica retomando a mesma instância.
        console.log(`[Baileys] Instância ${instanceName}: restart requerido (515) — reconectando imediatamente...`);
        setTimeout(() => createSocket(instanceName).catch(console.error), 100);
      } else if (reason === DisconnectReason.connectionReplaced) {
        // Outra réplica autenticou como este mesmo canal (WhatsApp só permite
        // uma conexão viva por sessão). Esta réplica perdeu de verdade: libera
        // o lock e espera um backoff maior antes de tentar de novo, em vez de
        // reconectar imediatamente e colidir outra vez (loop infinito).
        console.log(`[Baileys] Instância ${instanceName}: sessão substituída por outra conexão (440) — liberando lock e aguardando ${CONFLICT_RETRY_DELAY_MS}ms...`);
        if (session.lockClient) await releaseInstanceLock(instanceName, session.lockClient).catch(() => {});
        session.lockClient = null;
        setTimeout(() => createSocket(instanceName).catch(console.error), CONFLICT_RETRY_DELAY_MS);
      } else {
        // Backoff exponencial: 5s, 10s, 20s, 40s (máx 60s) para evitar rate-limit do WA
        const attempts = (session.reconnectAttempts ?? 0) + 1;
        session.reconnectAttempts = attempts;
        const delay = Math.min(5_000 * Math.pow(2, attempts - 1), 60_000);
        console.log(`[Baileys] Instância ${instanceName}: reconectando (reason=${reason}, tentativa=${attempts}, delay=${delay}ms)...`);
        setTimeout(() => createSocket(instanceName).catch(console.error), delay);
      }
    } else if (connection === "connecting") {
      session.status = "connecting";
      await handleConnectionUpdate(instanceName, { state: "connecting" }).catch(() => {});
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }: { messages: WAMessage[]; type: string }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      const rawJid = msg.key?.remoteJid ?? "";
      if (isIgnorableJid(rawJid)) continue;

      // Resolve LID → telefone real antes de processar (ver resolveRealJid)
      const jid = await resolveRealJid(sock, msg.key ?? {});
      if (!jid) {
        console.warn(
          `[Baileys] Instância ${instanceName}: mensagem ${msg.key?.id} descartada — não foi possível resolver o LID "${rawJid}" para um telefone real.`,
        );
        continue;
      }

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
        // Sobrescreve remoteJid com o JID resolvido (telefone real, não LID),
        // para que jidToPhone a jusante extraia o número correto.
        key: { ...msg.key, remoteJid: jid },
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

export function startInstance(
  instanceName: string,
  explicitLock?: PoolClient | null,
): { instanceId: string; status: string } {
  if (sessions.has(instanceName)) {
    const s = sessions.get(instanceName)!;
    return { instanceId: s.instanceId, status: s.status };
  }
  const instanceId = crypto.randomUUID();
  sessions.set(instanceName, {
    socket: null as unknown as WASocket,
    instanceId,
    status: "connecting",
    qrBase64: null,
    qrCode: null,
    reconnectAttempts: 0,
    lockClient: explicitLock ?? null,
  });
  createSocket(instanceName, explicitLock).catch((err) =>
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

// Usado pelo job de reconciliação: evita que esta réplica sonde o próprio
// lock quando ela mesma já é a dona (confia no fluxo reativo de
// handleConnectionUpdate em vez de disputar com ele).
export function hasLocalLock(instanceName: string): boolean {
  return sessions.get(instanceName)?.lockClient != null;
}

export async function logoutInstance(instanceName: string): Promise<void> {
  const s = sessions.get(instanceName);
  if (s) {
    try { await s.socket?.logout(); } catch { /* ignore */ }
    if (s.lockClient) await releaseInstanceLock(instanceName, s.lockClient).catch(() => {});
    sessions.delete(instanceName);
  }
  // Sempre propaga: a réplica que atendeu a requisição pode não ser a dona do
  // socket vivo. Sem isso, a réplica dona (se houver) fica com o socket e o
  // lock "órfãos" — presos para sempre, travando qualquer conexão futura.
  broadcastInstanceCommand(instanceName, "logout");
  await deleteInstanceCreds(pool, instanceName).catch(() => {});
}

/**
 * Fecha o socket atual (se existir), apaga todas as credenciais do banco e
 * inicia um socket novo com estado completamente limpo.
 * Deve ser usado quando o usuário clica "Conectar via QR" explicitamente, para
 * evitar que chaves Signal obsoletas causem erro 401 device_removed no WA.
 */
export async function forceRestartInstance(instanceName: string): Promise<{ instanceId: string; status: string }> {
  const existing = sessions.get(instanceName);
  // Se já está conectado, não interrompe a sessão
  if (existing?.status === "connected") {
    return { instanceId: existing.instanceId, status: existing.status };
  }

  // `existing` só reflete o estado desta réplica. Se esta réplica não detém o
  // lock da instância (sessão inexistente aqui, ou existente mas ainda
  // aguardando o lock — lockClient null), outra réplica pode ter uma sessão
  // viva e saudável. Adquirir o lock ANTES de apagar credenciais evita
  // destruir uma conexão boa em outra réplica; se não conseguir, não mexe em
  // nada e apenas reporta o estado atual conhecido.
  let lockClient = existing?.lockClient ?? null;
  if (!lockClient) {
    lockClient = await tryAcquireInstanceLock(instanceName);
    if (!lockClient) {
      return {
        instanceId: existing?.instanceId ?? crypto.randomUUID(),
        status: getConnectionState(instanceName),
      };
    }
  }

  // Encerra o socket atual sem chamar logout no WA (a sessão já está quebrada)
  if (existing?.socket) {
    try { existing.socket.end(undefined); } catch { /* ignore */ }
  }
  sessions.delete(instanceName);
  // Limpa credenciais obsoletas para forçar novo par de chaves Signal
  await deleteInstanceCreds(pool, instanceName).catch(() => {});
  // Reaproveita o lockClient já adquirido — createSocket não tenta de novo.
  return startInstance(instanceName, lockClient);
}

export async function destroyInstance(instanceName: string): Promise<void> {
  await logoutInstance(instanceName);
}

/**
 * Encerra todos os sockets Baileys ativos nesta réplica e libera seus locks,
 * sem apagar credenciais (a sessão continua válida, só muda de dono).
 * Deve ser chamado no shutdown (SIGTERM/SIGINT) para reduzir a janela de
 * overlap com a réplica que está subindo no lugar desta.
 */
export async function shutdownAllSessions(): Promise<void> {
  const entries = Array.from(sessions.entries());
  await Promise.all(
    entries.map(async ([instanceName, s]) => {
      try { s.socket?.end(undefined); } catch { /* ignore */ }
      if (s.lockClient) await releaseInstanceLock(instanceName, s.lockClient).catch(() => {});
      // Best-effort: se o Baileys não disparar connection.update("close") a
      // tempo do processo encerrar (comum em SIGTERM do Cloud Run durante
      // deploy), o banco ficaria preso em "connected" para sempre. Timeout
      // curto para não atrasar o shutdown se o Postgres estiver fora do ar.
      await withTimeout(markChannelDisconnected(instanceName), 3000).catch(() => {});
    }),
  );
  sessions.clear();
}

async function markChannelDisconnected(instanceName: string): Promise<void> {
  const channel = await getChannelByEvolutionInstance(instanceName);
  if (!channel) return;
  await updateConnectionStatus(channel.id, "disconnected");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

interface EvolutionSendResultLike {
  key: { remoteJid: string; fromMe: boolean; id: string };
  status: string;
}

async function sendTextLocal(
  s: SessionInfo,
  instanceName: string,
  to: string,
  text: string,
  options: { delay?: number; quotedMsgId?: string },
): Promise<EvolutionSendResultLike> {
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

async function sendMediaLocal(
  s: SessionInfo,
  instanceName: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video",
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string; delay?: number },
): Promise<EvolutionSendResultLike> {
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

export async function sendText(
  instanceName: string,
  to: string,
  text: string,
  options: { delay?: number; quotedMsgId?: string } = {},
): Promise<EvolutionSendResultLike> {
  const s = sessions.get(instanceName);
  if (s?.socket) return sendTextLocal(s, instanceName, to, text, options);
  // Sem socket nesta réplica — pode estar vivo em outra (Cloud Run autoscale,
  // sem sticky sessions). Encaminha via LISTEN/NOTIFY em vez de falhar direto.
  return forwardSendCommand({ kind: "send_text", instanceName, to, text, options });
}

export async function sendMedia(
  instanceName: string,
  to: string,
  mediaType: "image" | "document" | "audio" | "video",
  opts: { url?: string; base64?: string; filename?: string; caption?: string; mimetype?: string; delay?: number },
): Promise<EvolutionSendResultLike> {
  const s = sessions.get(instanceName);
  if (s?.socket) return sendMediaLocal(s, instanceName, to, mediaType, opts);
  if (opts.base64) {
    // Payload base64 estoura de longe o limite de 8000 bytes do NOTIFY do
    // Postgres — sem encaminhamento possível, falha como hoje.
    throw new Error(`Instância "${instanceName}" não encontrada ou desconectada`);
  }
  return forwardSendCommand({ kind: "send_media", instanceName, to, mediaType, opts });
}

// ── Encaminhamento de envio entre réplicas (Postgres LISTEN/NOTIFY) ─────────────
//
// Mesmo raciocínio do comando de logout acima: a réplica que atende a
// requisição HTTP de envio pode não ser a dona do socket vivo. Em vez de
// falhar direto com "não encontrada ou desconectada", publica um comando de
// envio no mesmo canal e aguarda a réplica dona executar e responder.

const NOTIFY_PAYLOAD_SAFE_LIMIT = 7500; // margem abaixo do limite real de 8000 bytes do Postgres
const SEND_FORWARD_TIMEOUT_MS = 15_000;

type SendForwardCommand =
  | { kind: "send_text"; instanceName: string; to: string; text: string; options: { delay?: number; quotedMsgId?: string } }
  | {
      kind: "send_media";
      instanceName: string;
      to: string;
      mediaType: "image" | "document" | "audio" | "video";
      opts: { url?: string; filename?: string; caption?: string; mimetype?: string; delay?: number };
    };

type RemoteSendCommand = SendForwardCommand & { action: string; correlationId: string };

type SendResultPayload = {
  action: "send_result";
  correlationId: string;
  ok: boolean;
  result?: EvolutionSendResultLike;
  error?: string;
};

const pendingSendRequests = new Map<
  string,
  { resolve: (v: EvolutionSendResultLike) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
>();

async function forwardSendCommand(cmd: SendForwardCommand): Promise<EvolutionSendResultLike> {
  const notFoundErr = () => new Error(`Instância "${cmd.instanceName}" não encontrada ou desconectada`);
  const correlationId = crypto.randomUUID();
  const payload = { action: cmd.kind, correlationId, ...cmd };

  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > NOTIFY_PAYLOAD_SAFE_LIMIT) {
    // Mensagem grande demais para caber num NOTIFY — não adianta tentar.
    throw notFoundErr();
  }

  return new Promise<EvolutionSendResultLike>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingSendRequests.delete(correlationId);
      reject(notFoundErr()); // ninguém respondeu — trata como genuinamente offline
    }, SEND_FORWARD_TIMEOUT_MS);
    pendingSendRequests.set(correlationId, { resolve, reject, timer });

    publishCmd(payload).catch((err) => {
      clearTimeout(timer);
      pendingSendRequests.delete(correlationId);
      reject(err);
    });
  });
}

function handleSendResult(payload: SendResultPayload): void {
  const pending = pendingSendRequests.get(payload.correlationId);
  if (!pending) return; // não é nosso (outra réplica), ou já expirou — ignora
  clearTimeout(pending.timer);
  pendingSendRequests.delete(payload.correlationId);
  if (payload.ok && payload.result) pending.resolve(payload.result);
  else pending.reject(new Error(payload.error ?? "Falha ao encaminhar envio entre réplicas"));
}

async function handleRemoteSendCommand(cmd: RemoteSendCommand): Promise<void> {
  const s = sessions.get(cmd.instanceName);
  // Sem socket local: pode ser a própria réplica que originou o pedido
  // recebendo de volta seu próprio broadcast (Postgres entrega NOTIFY a todo
  // listener do canal, inclusive quem publicou). Ignora silenciosamente — não
  // responde, não reencaminha.
  if (!s?.socket) return;

  try {
    const result =
      cmd.kind === "send_text"
        ? await sendTextLocal(s, cmd.instanceName, cmd.to, cmd.text, cmd.options)
        : await sendMediaLocal(s, cmd.instanceName, cmd.to, cmd.mediaType, cmd.opts);
    await publishCmd({ action: "send_result", correlationId: cmd.correlationId, ok: true, result });
  } catch (err) {
    await publishCmd({
      action: "send_result",
      correlationId: cmd.correlationId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }).catch(console.error);
  }
}

export async function getProfilePictureUrl(instanceName: string, to: string): Promise<string | null> {
  const s = sessions.get(instanceName);
  if (!s?.socket) return null;
  const jid = normalizeToJid(to);
  try {
    return (await s.socket.profilePictureUrl(jid, "image")) ?? null;
  } catch {
    // Sem foto, privacidade restrita, ou erro de rede — tudo tratado como "sem foto".
    return null;
  }
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
