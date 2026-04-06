import { createHmac, timingSafeEqual } from "crypto";
import { db } from "../db";
import {
  blingConnections,
  pubsubProcessingLogs,
  users,
  type BlingConnection,
} from "../../shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { decryptToken } from "../lib/token-crypto";
import {
  getBlingPedidoVenda,
  getBlingContato,
  type BlingPedidoVenda,
  type BlingContato,
} from "../integrations/bling";
import { blingOrdersService } from "./bling-orders.service";
import type {
  BlingControlPubSubMessage,
  SalesOrder,
  Seller,
  Contact,
  OrderItem,
  Installment,
  Situation,
  Store,
} from "../types/bling-orders-message";

// ---------------------------------------------------------------------------
// Tipos do payload de webhook do Bling
// ---------------------------------------------------------------------------

interface BlingWebhookOrderPayload {
  id: number;
  data?: string;
  numero?: number;
  numeroLoja?: string | null;
  total?: number;
  contato?: { id: number };
  vendedor?: { id: number } | null;
  loja?: { id: number };
  situacao?: { id: number; valor: number };
}

interface BlingWebhookDeletePayload {
  id: number;
}

export interface BlingWebhookEvent {
  eventId: string;
  date: string;
  version: string;
  event: string;
  companyId: string;
  data: BlingWebhookOrderPayload | BlingWebhookDeletePayload;
}

// ---------------------------------------------------------------------------
// Verificação HMAC
// ---------------------------------------------------------------------------

/**
 * Verifica a assinatura HMAC-SHA256 enviada pelo Bling no header
 * `X-Bling-Signature-256`. A comparação usa `timingSafeEqual` para evitar
 * timing attacks.
 */
export function verifyBlingSignature(
  rawBody: Buffer,
  clientSecret: string,
  signatureHeader: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedHash = signatureHeader.slice("sha256=".length);

  const expectedHash = createHmac("sha256", clientSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expectedHash, "hex"),
      Buffer.from(receivedHash, "hex"),
    );
  } catch {
    // Buffer lengths diferem — assinatura inválida
    return false;
  }
}

// ---------------------------------------------------------------------------
// Resolução de conexão por companyId
// ---------------------------------------------------------------------------

/**
 * Busca a conexão Bling ativa pelo companyId recebido no webhook.
 * Retorna null se nenhuma conexão ativa com aquele companyId for encontrada.
 */
export async function resolveConnectionByCompanyId(
  companyId: string,
): Promise<BlingConnection | null> {
  const [connection] = await db
    .select()
    .from(blingConnections)
    .where(
      and(
        eq(blingConnections.blingCompanyId, companyId),
        inArray(blingConnections.status, ["connected", "reauth_required"]),
      ),
    )
    .limit(1);

  return connection ?? null;
}

// ---------------------------------------------------------------------------
// Lookup de sellerName no banco de dados local
// ---------------------------------------------------------------------------

export async function resolveSellerName(
  blingVendedorId: number | null,
): Promise<string | null> {
  if (!blingVendedorId) return null;

  try {
    const [user] = await db
      .select({ blingVendedorName: users.blingVendedorName, name: users.name })
      .from(users)
      .where(eq(users.blingVendedorId, String(blingVendedorId)))
      .limit(1);

    if (!user) return null;
    return user.blingVendedorName ?? user.name ?? null;
  } catch (error) {
    console.error("[BlingWebhookService] Erro ao resolver sellerName:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Adapter: BlingPedidoVenda → SalesOrder (tipo do bling-orders.service)
// ---------------------------------------------------------------------------

export function mapPedidoToSalesOrder(
  pedido: BlingPedidoVenda,
  contato: BlingContato | null,
  sellerName: string | null,
): SalesOrder {
  const seller: Seller = {
    id: pedido.vendedor?.id ?? null,
    nome: sellerName,
  };

  const contact: Contact = {
    id: pedido.contato.id,
    nome: contato?.nome ?? pedido.contato.nome,
    tipo: (contato?.tipo ?? pedido.contato.tipoPessoa ?? null) as
      | "F"
      | "J"
      | "E"
      | null,
    documento:
      contato?.numeroDocumento ?? pedido.contato.numeroDocumento ?? null,
    email: contato?.email ?? null,
    telefone: contato?.telefone ?? null,
    celular: contato?.celular ?? null,
    fantasia: contato?.fantasia ?? null,
    endereco: contato?.endereco
      ? {
          endereco: contato.endereco.endereco ?? undefined,
          numero: contato.endereco.numero ?? undefined,
          complemento: contato.endereco.complemento ?? undefined,
          bairro: contato.endereco.bairro ?? undefined,
          municipio: contato.endereco.municipio ?? undefined,
          uf: contato.endereco.uf ?? undefined,
          cep: contato.endereco.cep ?? undefined,
        }
      : null,
  };

  const itens: OrderItem[] = (pedido.itens ?? []).map((item) => ({
    id: item.produto?.id ?? undefined,
    codigo: item.codigo || undefined,
    descricao: item.descricao || undefined,
    quantidade: item.quantidade,
    valor: item.valor,
    desconto: item.desconto ?? undefined,
  }));

  const parcelas: Installment[] = (pedido.parcelas ?? []).map((p) => ({
    id: p.id,
    dataVencimento: p.dataVencimento,
    valor: p.valor,
    observacoes: p.observacoes || undefined,
    formaPagamento: p.formaPagamento ? { id: p.formaPagamento.id } : undefined,
  }));

  const situacao: Situation | undefined = pedido.situacao
    ? { id: pedido.situacao.id, valor: String(pedido.situacao.valor) }
    : undefined;

  const loja: Store = { id: pedido.loja.id };

  return {
    id: pedido.id,
    numero: pedido.numero,
    numeroLoja: pedido.numeroLoja ?? undefined,
    data: pedido.data,
    total: pedido.total,
    vendedor: seller,
    contato: contact,
    itens,
    parcelas,
    situacao,
    loja,
    dataSaida: pedido.dataSaida ?? undefined,
    dataPrevista: pedido.dataPrevista ?? undefined,
    observacoes: pedido.observacoes ?? undefined,
    observacoesInternas: pedido.observacoesInternas ?? undefined,
  };
}

export function buildMessage(
  order: SalesOrder,
  eventType: "created" | "updated" | "deleted",
  connection: BlingConnection,
  eventId: string,
  companyId: string,
): BlingControlPubSubMessage {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    source: "bling-control",
    metadata: {
      accountId: connection.id,
      userId: connection.userId,
      accountName: connection.blingAccountName ?? undefined,
      eventId,
      companyId,
    },
    order,
  };
}

// ---------------------------------------------------------------------------
// Processamento de logs (reutiliza pubsubProcessingLogs)
// ---------------------------------------------------------------------------

async function isEventProcessed(eventId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: pubsubProcessingLogs.id })
    .from(pubsubProcessingLogs)
    .where(
      and(
        eq(pubsubProcessingLogs.messageId, eventId),
        inArray(pubsubProcessingLogs.status, ["success", "processing"]),
      ),
    )
    .limit(1);
  return !!existing;
}

async function createProcessingLog(
  eventId: string,
  eventType: "created" | "updated" | "deleted",
  blingOrderId: string,
  accountId: string,
  userId: string,
  rawEvent: string,
): Promise<string> {
  const [log] = await db
    .insert(pubsubProcessingLogs)
    .values({
      messageId: eventId,
      eventType,
      blingOrderId,
      status: "processing",
      attempts: 1,
      rawMessage: rawEvent,
      accountId,
      userId,
    })
    .returning({ id: pubsubProcessingLogs.id });
  return log.id;
}

async function markLogSuccess(logId: string): Promise<void> {
  await db
    .update(pubsubProcessingLogs)
    .set({ status: "success", processedAt: new Date(), updatedAt: new Date() })
    .where(eq(pubsubProcessingLogs.id, logId));
}

async function markLogFailed(logId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  await db
    .update(pubsubProcessingLogs)
    .set({
      status: "failed",
      errorMessage: message,
      errorStack: stack,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pubsubProcessingLogs.id, logId));
}

// ---------------------------------------------------------------------------
// Helper: obtém access token descriptografado e cria callback de refresh
// ---------------------------------------------------------------------------

export function getAccessTokenAndRefresher(connection: BlingConnection): {
  accessToken: string;
  onTokenRefresh: () => Promise<string>;
} {
  if (!connection.accessTokenEncrypted) {
    throw new Error(
      `Conexão ${connection.id} sem access token — reconecte a conta Bling.`,
    );
  }

  const accessToken = decryptToken(connection.accessTokenEncrypted);

  const onTokenRefresh = async (): Promise<string> => {
    // Re-lê a conexão do banco para pegar o token mais recente (pode ter sido
    // renovado pelo scheduler na janela entre o início do processamento e agora)
    const [fresh] = await db
      .select()
      .from(blingConnections)
      .where(eq(blingConnections.id, connection.id))
      .limit(1);

    if (!fresh?.accessTokenEncrypted) {
      throw new Error(`Conexão ${connection.id} sem access token após refresh`);
    }

    return decryptToken(fresh.accessTokenEncrypted);
  };

  return { accessToken, onTokenRefresh };
}

// ---------------------------------------------------------------------------
// Fila sequencial rate-limited (≤ 2.8 req/s → 350 ms entre chamadas)
// ---------------------------------------------------------------------------

const RATE_LIMIT_DELAY_MS = 350;

interface QueueItem {
  event: BlingWebhookEvent;
  connection: BlingConnection;
}

let queue: QueueItem[] = [];
let isProcessing = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function enqueueWebhookEvent(
  event: BlingWebhookEvent,
  connection: BlingConnection,
): void {
  queue.push({ event, connection });
  if (!isProcessing) {
    void processQueue();
  }
}

async function processQueue(): Promise<void> {
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      await processWebhookEvent(item.event, item.connection);
    } catch (error) {
      console.error(
        `[BlingWebhookService] Falha ao processar evento ${item.event.eventId}:`,
        error,
      );
    }
    if (queue.length > 0) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  isProcessing = false;
}

// ---------------------------------------------------------------------------
// Processamento central de evento
// ---------------------------------------------------------------------------

async function processWebhookEvent(
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  const [resource, action] = event.event.split(".");

  if (resource !== "order") {
    console.info(`[BlingWebhookService] Recurso ignorado: ${event.event}`);
    return;
  }

  if (!["created", "updated", "deleted"].includes(action)) {
    console.info(
      `[BlingWebhookService] Ação desconhecida ignorada: ${event.event}`,
    );
    return;
  }

  const eventType = action as "created" | "updated" | "deleted";
  const payload = event.data as BlingWebhookOrderPayload;

  // Idempotência: aborta se já processado
  if (await isEventProcessed(event.eventId)) {
    console.info(
      `[BlingWebhookService] Evento ${event.eventId} já processado — ignorando.`,
    );
    return;
  }

  const blingOrderIdStr = String(payload.id);
  const rawEvent = JSON.stringify(event);

  let logId: string | null = null;

  try {
    logId = await createProcessingLog(
      event.eventId,
      eventType,
      blingOrderIdStr,
      connection.id,
      connection.userId,
      rawEvent,
    );
  } catch (logError: unknown) {
    const isUniqueViolation =
      typeof logError === "object" &&
      logError !== null &&
      "code" in logError &&
      (logError as { code: string }).code === "23505";

    if (isUniqueViolation) {
      console.warn(
        `[BlingWebhookService] Evento ${event.eventId} já em processamento (unique violation) — ignorando.`,
      );
      return;
    }
    // Qualquer outro erro (ex: falha de conexão) não deve silenciosamente descartar o evento
    throw logError;
  }

  try {
    if (eventType === "deleted") {
      await processDeleteEvent(payload.id, event, connection);
    } else {
      await processCreateOrUpdateEvent(
        eventType,
        payload.id,
        event,
        connection,
      );
    }

    if (logId) await markLogSuccess(logId);
  } catch (error) {
    console.error(
      `[BlingWebhookService] Erro ao processar evento ${event.eventId} (${event.event}):`,
      error,
    );
    if (logId) await markLogFailed(logId, error);
    throw error;
  }
}

async function processCreateOrUpdateEvent(
  eventType: "created" | "updated",
  orderId: number,
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  const { accessToken, onTokenRefresh } =
    getAccessTokenAndRefresher(connection);

  // 1) Busca detalhes completos do pedido (conta como 1 req para o rate limit)
  const pedido = await getBlingPedidoVenda(
    accessToken,
    orderId,
    onTokenRefresh,
  );

  // 2) Aguarda RATE_LIMIT_DELAY_MS antes da próxima requisição API
  await sleep(RATE_LIMIT_DELAY_MS);

  // 3) Busca dados do contato para telefone/celular/tipo/documento
  let contato: BlingContato | null = null;
  try {
    contato = await getBlingContato(
      accessToken,
      pedido.contato.id,
      onTokenRefresh,
    );
  } catch (error) {
    console.warn(
      `[BlingWebhookService] Não foi possível buscar contato ${pedido.contato.id} — prosseguindo sem dados do contato:`,
      error,
    );
  }

  // 4) Resolve sellerName via banco (sem chamada à API)
  const sellerName = await resolveSellerName(pedido.vendedor?.id ?? null);

  // 5) Converte para o formato esperado pelo blingOrdersService
  const salesOrder = mapPedidoToSalesOrder(pedido, contato, sellerName);
  const message = buildMessage(
    salesOrder,
    eventType,
    connection,
    event.eventId,
    event.companyId,
  );

  if (eventType === "created") {
    await blingOrdersService.createOrder({ message });
  } else {
    await blingOrdersService.updateOrder({ message });
  }

  console.info(
    `[BlingWebhookService] Evento ${event.event} processado com sucesso para pedido ${orderId}.`,
  );
}

async function processDeleteEvent(
  orderId: number,
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  // Delete: não precisa buscar detalhes na API — apenas o ID é suficiente
  const minimalOrder: SalesOrder = {
    id: orderId,
    numero: orderId, // não usado no deleteOrder, mas campo obrigatório
    data: new Date().toISOString().split("T")[0],
    total: 0,
    vendedor: { id: null, nome: null },
    contato: { id: 0, nome: null },
    itens: [],
    loja: { id: 0 },
  };

  const message = buildMessage(
    minimalOrder,
    "deleted",
    connection,
    event.eventId,
    event.companyId,
  );

  await blingOrdersService.deleteOrder({ message });

  console.info(
    `[BlingWebhookService] Evento order.deleted processado com sucesso para pedido ${orderId}.`,
  );
}
