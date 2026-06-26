import { createHmac, timingSafeEqual } from "crypto";
import { db } from "../db";
import {
  blingConnections,
  blingSellerMappings,
  blingProductMappings,
  pubsubProcessingLogs,
  users,
  type BlingConnection,
} from "../../shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { decryptToken } from "../lib/token-crypto";
import {
  getBlingPedidoVenda,
  getBlingContato,
  getBlingProduto,
  getBlingCategoriaProduto,
  mapBlingCategoryToWineType,
  mapBlingCategoryToCountry,
  BlingApiError,
  type BlingWineType,
  type BlingWineCountry,
  type BlingPedidoVenda,
  type BlingContato,
} from "../integrations/bling";
import { products } from "../../shared/schema";
import { blingOrdersService } from "./bling-orders.service";
import { blingConnectionsService } from "./bling-connections.service";
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

interface BlingWebhookProductPayload {
  id: number;
}

export interface BlingWebhookEvent {
  eventId: string;
  date: string;
  version: string;
  event: string;
  companyId: string;
  data: BlingWebhookOrderPayload | BlingWebhookDeletePayload | BlingWebhookProductPayload;
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
// Lookup de sellerName no banco de dados local
// ---------------------------------------------------------------------------

export async function resolveSellerName(
  blingVendedorId: number | null,
  connectionId?: string | null,
): Promise<string | null> {
  if (!blingVendedorId) return null;

  try {
    // Prioridade 1: blingSellerMappings (multi-conta)
    if (connectionId) {
      const [mapping] = await db
        .select({ blingVendedorName: blingSellerMappings.blingVendedorName, userId: blingSellerMappings.userId })
        .from(blingSellerMappings)
        .where(
          and(
            eq(blingSellerMappings.connectionId, connectionId),
            eq(blingSellerMappings.blingVendedorId, String(blingVendedorId)),
          ),
        )
        .limit(1);
      if (mapping) {
        if (mapping.blingVendedorName) return mapping.blingVendedorName;
        // Se tem userId mas não tem nome no mapping, busca nome do usuário
        if (mapping.userId) {
          const [user] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, mapping.userId))
            .limit(1);
          if (user?.name) return user.name;
        }
      }
    }

    // Fallback legado: campo direto em users
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
    // Força a renovação do token via refresh token (não apenas relê o valor
    // atual do banco — o token em DB pode estar igualmente expirado se o
    // scheduler ainda não rodou). refreshConnection persiste o novo token.
    try {
      await blingConnectionsService.refreshConnection(connection.id);
    } catch (error) {
      // Refresh token também inválido/expirado → conexão precisa de reauth.
      // Sinaliza como 401 para que o chamador traduza em "reconecte a conta".
      throw new BlingApiError(
        401,
        `Falha ao renovar token do Bling: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
// Helper: executa fn com controle de idempotência e log de processamento
// ---------------------------------------------------------------------------

async function runWithIdempotency(
  event: BlingWebhookEvent,
  connection: BlingConnection,
  resourceIdStr: string,
  eventType: "created" | "updated" | "deleted",
  fn: () => Promise<void>,
): Promise<void> {
  // Idempotência: aborta se já processado
  if (await isEventProcessed(event.eventId)) {
    console.info(
      `[BlingWebhookService] Evento ${event.eventId} já processado — ignorando.`,
    );
    return;
  }

  const rawEvent = JSON.stringify(event);
  let logId: string | null = null;

  try {
    logId = await createProcessingLog(
      event.eventId,
      eventType,
      resourceIdStr,
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
    throw logError;
  }

  try {
    await fn();
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

// ---------------------------------------------------------------------------
// Processamento central de evento
// ---------------------------------------------------------------------------

async function processWebhookEvent(
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  const [resource, action] = event.event.split(".");

  if (!["created", "updated", "deleted"].includes(action)) {
    console.info(
      `[BlingWebhookService] Ação desconhecida ignorada: ${event.event}`,
    );
    return;
  }

  const eventType = action as "created" | "updated" | "deleted";

  if (resource === "order") {
    const payload = event.data as BlingWebhookOrderPayload;
    await runWithIdempotency(
      event,
      connection,
      String(payload.id),
      eventType,
      async () => {
        if (eventType === "deleted") {
          await processDeleteEvent(payload.id, event, connection);
        } else {
          await processCreateOrUpdateEvent(eventType, payload.id, event, connection);
        }
      },
    );
  } else if (resource === "product") {
    const payload = event.data as BlingWebhookProductPayload;
    await runWithIdempotency(
      event,
      connection,
      String(payload.id),
      eventType,
      async () => {
        if (eventType === "deleted") {
          await processProductDeleteEvent(payload.id, event, connection);
        } else {
          await processProductCreateOrUpdateEvent(eventType, payload.id, event, connection);
        }
      },
    );
  } else {
    console.info(`[BlingWebhookService] Recurso ignorado: ${event.event}`);
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
  const sellerName = await resolveSellerName(pedido.vendedor?.id ?? null, connection.id);

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
    await blingOrdersService.createOrder({ message, connectionId: connection.id });
  } else {
    await blingOrdersService.updateOrder({ message, connectionId: connection.id });
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

  await blingOrdersService.deleteOrder({ message, connectionId: connection.id });

  console.info(
    `[BlingWebhookService] Evento order.deleted processado com sucesso para pedido ${orderId}.`,
  );
}

// ---------------------------------------------------------------------------
// Processamento de eventos de produto
// ---------------------------------------------------------------------------

/**
 * Resolve os campos `type` (tipo do vinho) e `country` (país do vinho) a
 * partir da categoria do produto no Bling.
 *
 * - A categoria direta do produto → `type`
 * - A categoria pai (se `id > 0`) → `country`
 *
 * Ambas as chamadas são cercadas de try/catch para que uma falha na API de
 * categorias não interrompa o upsert do produto; nesse caso os campos ficam
 * com os valores default.
 */
async function resolveCategoryFields(
  accessToken: string,
  onTokenRefresh: () => Promise<string>,
  blingCategoriaId: number | null | undefined,
): Promise<{ type: BlingWineType; country: BlingWineCountry }> {
  if (!blingCategoriaId) {
    return { type: "TINTO", country: "OUTROS" };
  }

  let wineType: BlingWineType = "TINTO";
  let wineCountry: BlingWineCountry = "OUTROS";

  // Busca categoria (tipo do vinho)
  let categoriaPaiId: number | null = null;
  try {
    await sleep(RATE_LIMIT_DELAY_MS);
    const categoria = await getBlingCategoriaProduto(
      accessToken,
      blingCategoriaId,
      onTokenRefresh,
    );
    wineType = mapBlingCategoryToWineType(categoria.descricao);
    categoriaPaiId =
      categoria.categoriaPai?.id && categoria.categoriaPai.id > 0
        ? categoria.categoriaPai.id
        : null;
  } catch (error) {
    console.warn(
      `[BlingWebhookService] Não foi possível buscar categoria ${blingCategoriaId} — usando tipo default:`,
      error,
    );
    return { type: wineType, country: wineCountry };
  }

  // Busca categoria pai (país do vinho)
  if (categoriaPaiId) {
    try {
      await sleep(RATE_LIMIT_DELAY_MS);
      const categoriaPai = await getBlingCategoriaProduto(
        accessToken,
        categoriaPaiId,
        onTokenRefresh,
      );
      wineCountry = mapBlingCategoryToCountry(categoriaPai.descricao);
    } catch (error) {
      console.warn(
        `[BlingWebhookService] Não foi possível buscar categoria pai ${categoriaPaiId} — usando país default:`,
        error,
      );
    }
  }

  return { type: wineType, country: wineCountry };
}

/**
 * Trata eventos `product.created` e `product.updated`.
 *
 * Busca os detalhes completos do produto no Bling via `getBlingProduto` e
 * realiza um upsert na tabela local `products`:
 * - Se o produto já existe (por `blingProductId`): atualiza nome, preço e
 *   imagem, e remove o soft-delete caso estivesse marcado.
 * - Se não existe: insere com valores default para campos obrigatórios que
 *   não estão disponíveis no payload do Bling (country, volume, type).
 */
async function processProductCreateOrUpdateEvent(
  eventType: "created" | "updated",
  productId: number,
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  const { accessToken, onTokenRefresh } = getAccessTokenAndRefresher(connection);

  // 1) Busca detalhes completos do produto na API do Bling
  const blingProduct = await getBlingProduto(accessToken, productId, onTokenRefresh);

  const blingProductIdStr = String(productId);
  const imageUrl = blingProduct.midia?.imagens?.internas?.[0]?.link ?? null;
  const preco = blingProduct.preco ?? 0;

  // 2) Resolve tipo e país a partir da categoria do produto no Bling.
  //    Cada chamada à API de categoria já aplica o RATE_LIMIT_DELAY_MS internamente.
  const { type: wineType, country: wineCountry } = await resolveCategoryFields(
    accessToken,
    onTokenRefresh,
    blingProduct.categoria?.id,
  );

  // 3) Verifica se o produto já existe via blingProductMappings (multi-conta)
  //    com fallback para products.blingProductId (legado)
  const [existingMapping] = await db
    .select({ id: blingProductMappings.productId })
    .from(blingProductMappings)
    .where(
      and(
        eq(blingProductMappings.connectionId, connection.id),
        eq(blingProductMappings.blingProductId, blingProductIdStr),
      ),
    )
    .limit(1);

  const existingProductId = existingMapping?.id ?? null;

  // Fallback legado: busca por blingProductId diretamente no produto
  const [legacyProduct] = existingProductId
    ? []
    : await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.blingProductId, blingProductIdStr))
        .limit(1);

  const resolvedProductId = existingProductId ?? legacyProduct?.id ?? null;

  if (resolvedProductId) {
    // UPDATE: atualiza nome, preço, imagem, tipo, país e reativa se estava soft-deleted
    await db
      .update(products)
      .set({
        ...(blingProduct.nome ? { name: blingProduct.nome } : {}),
        ...(preco > 0 ? { negotiatedPrice: preco.toFixed(2) } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        type: wineType,
        country: wineCountry,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, resolvedProductId));

    // Garante que o mapping existe (caso tenha vindo do fallback legado)
    if (!existingProductId) {
      await db
        .insert(blingProductMappings)
        .values({ connectionId: connection.id, blingProductId: blingProductIdStr, productId: resolvedProductId })
        .onConflictDoNothing();
    }

    console.info(
      `[BlingWebhookService] Produto ${productId} atualizado no banco — tipo: ${wineType}, país: ${wineCountry} (evento: ${event.event}).`,
    );
  } else {
    // INSERT: cria produto e registra mapeamento
    const [inserted] = await db.insert(products).values({
      name: blingProduct.nome ?? `Produto ${productId}`,
      country: wineCountry,
      volume: "750ml",
      type: wineType,
      negotiatedPrice: preco.toFixed(2),
      createdBy: connection.userId,
      blingProductId: blingProductIdStr,
      ...(imageUrl ? { imageUrl } : {}),
    }).returning({ id: products.id });

    if (inserted) {
      await db
        .insert(blingProductMappings)
        .values({ connectionId: connection.id, blingProductId: blingProductIdStr, productId: inserted.id })
        .onConflictDoNothing();
    }

    console.info(
      `[BlingWebhookService] Produto ${productId} criado no banco — tipo: ${wineType}, país: ${wineCountry} (evento: ${event.event}).`,
    );
  }
}

/**
 * Trata o evento `product.deleted`.
 *
 * Realiza um soft-delete do produto local marcando `deletedAt` com a data
 * atual. O registro é mantido no banco para preservar histórico de vínculos
 * (ex: companyProducts). Se o produto não for encontrado, o evento é ignorado
 * de forma idempotente.
 */
async function processProductDeleteEvent(
  productId: number,
  event: BlingWebhookEvent,
  connection: BlingConnection,
): Promise<void> {
  const blingProductIdStr = String(productId);

  // Busca via blingProductMappings (multi-conta) com fallback legado
  const [existingMapping] = await db
    .select({ productId: blingProductMappings.productId })
    .from(blingProductMappings)
    .where(
      and(
        eq(blingProductMappings.connectionId, connection.id),
        eq(blingProductMappings.blingProductId, blingProductIdStr),
      ),
    )
    .limit(1);

  const resolvedProductId = existingMapping?.productId ?? null;

  // Fallback legado
  const [legacyProduct] = resolvedProductId
    ? []
    : await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.blingProductId, blingProductIdStr))
        .limit(1);

  const finalProductId = resolvedProductId ?? legacyProduct?.id ?? null;

  if (!finalProductId) {
    console.warn(
      `[BlingWebhookService] Produto ${productId} não encontrado no banco — evento ${event.event} ignorado (idempotente).`,
    );
    return;
  }

  await db
    .update(products)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(products.id, finalProductId));

  console.info(
    `[BlingWebhookService] Produto ${productId} marcado como deletado (soft delete) — evento ${event.event}.`,
  );
}
