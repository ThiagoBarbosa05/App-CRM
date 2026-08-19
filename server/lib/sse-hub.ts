import { Response } from "express";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

type Client = { userId: string; res: Response };

const clients = new Set<Client>();

// ── Broadcast cross-réplica via Postgres LISTEN/NOTIFY ──────────────────────────
//
// Em produção (Replit Autoscale) cada réplica é um processo Node isolado com seu
// próprio Set de clientes SSE em memória. Sem isso, um evento gerado numa réplica
// (ex.: QR/status de conexão do WhatsApp, cujo socket Baileys vive numa réplica
// específica) só chega aos navegadores conectados via SSE àquela mesma réplica —
// se o navegador estiver conectado a outra, o evento nunca chega e a tela fica
// esperando algo que não vai vir. NOTIFY replica o evento para todas as réplicas
// via Postgres; cada uma repassa aos seus próprios clientes locais.
//
// Payload do NOTIFY tem limite de ~8000 bytes no Postgres — eventos grandes
// (ex.: QR em base64) podem ultrapassar isso; nesse caso o broadcast cross-
// réplica é pulado (best-effort) e o evento ainda é entregue normalmente aos
// clientes locais desta réplica.
const NOTIFY_CHANNEL = "whatsapp_sse";
const NOTIFY_PAYLOAD_LIMIT = 7900;
const INSTANCE_ID = randomUUID();

type GlobalNotification = {
  scope: "global";
  event: string;
  data: unknown;
  userId?: string;
  originInstanceId: string;
};

type ConversationNotification = {
  scope: "conversation";
  conversationId: string;
  event: string;
  data: unknown;
  originInstanceId: string;
};

type ConversationAccessChangedNotification = {
  scope: "conversation_access_changed";
  conversationId: string;
  originInstanceId: string;
};

type HubNotification =
  | GlobalNotification
  | ConversationNotification
  | ConversationAccessChangedNotification;

type ConversationAccessChecker = (
  conversationId: string,
  userId: string,
  role: string,
) => Promise<boolean>;

let conversationAccessChecker: ConversationAccessChecker | null = null;

const listenPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
listenPool.on("error", (err: Error) => {
  console.error("[SSE hub] Erro inesperado na conexão de listen/notify:", err);
});

let listenClient: PoolClient | null = null;
let listenClientPromise: Promise<PoolClient> | null = null;

async function getListenClient(): Promise<PoolClient> {
  if (listenClient) return listenClient;
  if (!listenClientPromise) {
    listenClientPromise = (async () => {
      const client = await listenPool.connect();
      await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
      client.on("notification", (msg) => {
        if (msg.channel !== NOTIFY_CHANNEL || !msg.payload) return;
        try {
          handleRemoteNotification(JSON.parse(msg.payload) as unknown);
        } catch (err) {
          console.error("[SSE hub] Payload de notificação inválido:", err);
        }
      });
      client.on("error", (err: Error) => {
        console.error("[SSE hub] Conexão de listen caiu, será reconectada na próxima publicação:", err);
        listenClient = null;
        listenClientPromise = null;
      });
      listenClient = client;
      return client;
    })();
  }
  return listenClientPromise;
}

// Garante que esta réplica está ouvindo desde o boot, não só na primeira publicação.
getListenClient().catch((err) =>
  console.error("[SSE hub] Falha ao iniciar LISTEN de eventos SSE:", err),
);

// Per-conversation (whatsapp_conversations.id) subscribers — um cliente pode
// ter várias conversas paralelas (uma por canal/atendente), então a chave
// precisa ser o conversationId, nunca o clientId (que é ambíguo entre elas).
type ConversationSubscriber = { userId: string; role: string; res: Response };
const conversationClients = new Map<string, Set<ConversationSubscriber>>();

export function addConversationSseClient(
  conversationId: string,
  userId: string,
  role: string,
  res: Response,
): () => void {
  const subscriber: ConversationSubscriber = { userId, role, res };
  if (!conversationClients.has(conversationId)) conversationClients.set(conversationId, new Set());
  conversationClients.get(conversationId)!.add(subscriber);
  res.write(`:ok\n\n`);
  const ping = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);
  return () => {
    clearInterval(ping);
    const set = conversationClients.get(conversationId);
    if (set) {
      set.delete(subscriber);
      if (set.size === 0) conversationClients.delete(conversationId);
    }
  };
}

export function publishConversationEvent(conversationId: string, event: string, data: unknown): void {
  deliverConversationLocal(conversationId, event, data);
  publishCrossReplica({
    scope: "conversation",
    conversationId,
    event,
    data,
    originInstanceId: INSTANCE_ID,
  });
}

function deliverConversationLocal(conversationId: string, event: string, data: unknown): void {
  const set = conversationClients.get(conversationId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const sub of set) {
    try {
      sub.res.write(payload);
    } catch {
      set.delete(sub);
    }
  }
}

/** Registra a checagem de acesso usada ao receber transferências de outra réplica. */
export function registerConversationAccessChecker(checker: ConversationAccessChecker): void {
  conversationAccessChecker = checker;
}

/**
 * Reavalia o acesso de cada subscriber SSE conectado a uma conversa (chamado
 * após transferências de canal/setor/atendente) e encerra à força as
 * conexões que perderam o escopo — sem isso o cliente continuaria recebendo
 * "new_message" de uma conversa que não é mais dele até fechar a aba.
 * Recebe `checkAccess` como callback (em vez de importar
 * isConversationAccessibleToUser direto) para evitar import circular com
 * whatsapp-conversations.service.ts, que já importa deste módulo.
 */
export async function revokeStaleConversationAccess(
  conversationId: string,
  checkAccess: (userId: string, role: string) => Promise<boolean>,
): Promise<void> {
  await revokeStaleConversationAccessLocal(conversationId, checkAccess);
  publishCrossReplica({
    scope: "conversation_access_changed",
    conversationId,
    originInstanceId: INSTANCE_ID,
  });
}

async function revokeStaleConversationAccessLocal(
  conversationId: string,
  checkAccess: (userId: string, role: string) => Promise<boolean>,
): Promise<void> {
  const set = conversationClients.get(conversationId);
  if (!set) return;
  for (const sub of Array.from(set)) {
    const stillAllowed = await checkAccess(sub.userId, sub.role);
    if (stillAllowed) continue;
    try {
      sub.res.write(`event: access_revoked\ndata: {}\n\n`);
      sub.res.end();
    } catch {
      // ignore
    }
    set.delete(sub);
  }
  if (set.size === 0) conversationClients.delete(conversationId);
}

export function addSseClient(userId: string, res: Response): () => void {
  const client: Client = { userId, res };
  clients.add(client);
  res.write(`:ok\n\n`);
  const ping = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);
  return () => {
    clearInterval(ping);
    clients.delete(client);
  };
}

/**
 * Presença "online" de um usuário = há pelo menos uma conexão SSE aberta dele.
 * Limitação: o registro de conexões é local a ESTA réplica (o NOTIFY entre
 * réplicas propaga eventos, não conexões) — em deploy multi-réplica isto é uma
 * aproximação. Usado pelos operadores is_online/agent_online do bot.
 */
export function isUserOnline(userId: string): boolean {
  for (const c of clients) {
    if (c.userId === userId) return true;
  }
  return false;
}

/** Snapshot dos userIds com conexão SSE aberta nesta réplica (ver isUserOnline). */
export function getOnlineUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const c of clients) ids.add(c.userId);
  return ids;
}

// Entrega apenas aos clientes SSE conectados a ESTA réplica — usado tanto pela
// publicação local quanto pelos eventos recebidos via NOTIFY de outras réplicas.
function deliverLocal(event: string, data: unknown, userId?: string): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (userId && c.userId !== userId) continue;
    try {
      c.res.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}

/**
 * Envia evento SSE para um usuário específico (ou broadcast se userId omitido).
 * Entrega aos clientes locais e propaga para as demais réplicas via NOTIFY
 * (best-effort — se o payload for grande demais ou o NOTIFY falhar, a entrega
 * local ainda acontece normalmente).
 */
export function publishSseEvent(
  event: string,
  data: unknown,
  userId?: string,
): void {
  deliverLocal(event, data, userId);

  publishCrossReplica({
    scope: "global",
    event,
    data,
    ...(userId ? { userId } : {}),
    originInstanceId: INSTANCE_ID,
  });
}

function publishCrossReplica(notification: HubNotification): void {
  const notifyPayload = JSON.stringify(notification);
  if (notifyPayload.length > NOTIFY_PAYLOAD_LIMIT) return;

  getListenClient()
    .then((client) => client.query("SELECT pg_notify($1, $2)", [NOTIFY_CHANNEL, notifyPayload]))
    .catch((err) => console.error("[SSE hub] Falha ao propagar evento entre réplicas:", err));
}

function handleRemoteNotification(notification: unknown): void {
  if (!isRecord(notification)) return;

  // Compatibilidade com réplicas antigas durante deploy gradual.
  if (notification.scope === undefined) {
    if (typeof notification.event === "string") {
      deliverLocal(
        notification.event,
        notification.data,
        typeof notification.userId === "string" ? notification.userId : undefined,
      );
    }
    return;
  }

  if (notification.originInstanceId === INSTANCE_ID) return;

  if (
    notification.scope === "global" &&
    typeof notification.event === "string"
  ) {
    deliverLocal(
      notification.event,
      notification.data,
      typeof notification.userId === "string" ? notification.userId : undefined,
    );
    return;
  }

  if (
    notification.scope === "conversation" &&
    typeof notification.conversationId === "string" &&
    typeof notification.event === "string"
  ) {
    deliverConversationLocal(notification.conversationId, notification.event, notification.data);
    return;
  }

  if (
    notification.scope === "conversation_access_changed" &&
    typeof notification.conversationId === "string" &&
    conversationAccessChecker
  ) {
    const conversationId = notification.conversationId;
    void revokeStaleConversationAccessLocal(conversationId, (userId, role) =>
      conversationAccessChecker!(conversationId, userId, role),
    ).catch((err) =>
      console.error("[SSE hub] Falha ao revogar acesso de conversa em outra réplica:", err),
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
