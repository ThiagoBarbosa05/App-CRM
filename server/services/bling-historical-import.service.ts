/**
 * Serviço de importação histórica de pedidos de venda do Bling.
 *
 * Busca todos os pedidos de um período via paginação automática (100/página),
 * enriquece cada pedido com dados do contato (telefone/celular) e faz upsert
 * no banco de dados reutilizando a mesma lógica do webhook.
 *
 * Rate limit: respeita o limite de 3 req/s do Bling com 350 ms entre chamadas.
 */

import { db } from "../db";
import {
  blingOrders,
  blingConnections,
  type BlingConnection,
} from "../../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  getBlingPedidosVendas,
  getBlingPedidoVenda,
  getBlingContato,
  type BlingContato,
} from "../integrations/bling";
import { blingOrdersService } from "./bling-orders.service";
import {
  mapPedidoToSalesOrder,
  buildMessage,
  resolveSellerName,
  getAccessTokenAndRefresher,
} from "./bling-webhook.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ImportOrdersParams {
  /** Data inicial no formato yyyy-MM-dd */
  startDate: string;
  /** Data final no formato yyyy-MM-dd */
  endDate: string;
  /**
   * Quando true (padrão), re-importa pedidos já existentes fazendo update.
   * Quando false, apenas cria pedidos novos, pulando os já importados.
   */
  forceUpdate?: boolean;
  /** Filtra por ID de situação no Bling (ex: 9 = Atendido) */
  idSituacao?: number;
  /** Filtra por ID de loja no Bling */
  idLoja?: number;
}

export type ImportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface ImportProgress {
  status: ImportStatus;
  connectionId: string;
  startedAt: string | null;
  finishedAt: string | null;
  params: ImportOrdersParams | null;
  currentPage: number;
  totalFetched: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Até 50 erros individuais de pedidos específicos */
  errors: Array<{ orderId: number; error: string }>;
  cancelRequested: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const RATE_LIMIT_DELAY_MS = 350;
const PAGE_SIZE = 100;
const MAX_STORED_ERRORS = 50;

// ---------------------------------------------------------------------------
// In-memory store de progresso (uma entrada por connectionId)
// ---------------------------------------------------------------------------

const importStore = new Map<string, ImportProgress>();

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function orderExistsInDb(blingOrderId: number, connectionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: blingOrders.id })
    .from(blingOrders)
    .where(
      and(
        eq(blingOrders.connectionId, connectionId),
        eq(blingOrders.blingOrderId, String(blingOrderId)),
        isNull(blingOrders.deletedAt),
      ),
    )
    .limit(1);
  return !!row;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Retorna o estado atual da importação para uma conexão.
 * Se nunca foi iniciada, retorna estado "idle".
 */
export function getImportStatus(connectionId: string): ImportProgress {
  return (
    importStore.get(connectionId) ?? {
      status: "idle",
      connectionId,
      startedAt: null,
      finishedAt: null,
      params: null,
      currentPage: 0,
      totalFetched: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      cancelRequested: false,
    }
  );
}

/**
 * Solicita o cancelamento de uma importação em andamento.
 * O cancelamento é cooperativo — a importação para no próximo ponto de checagem.
 */
export function cancelImport(connectionId: string): boolean {
  const progress = importStore.get(connectionId);
  if (!progress || progress.status !== "running") return false;
  progress.cancelRequested = true;
  return true;
}

/**
 * Inicia a importação histórica de pedidos para uma conexão Bling.
 *
 * @returns true se a importação foi iniciada, false se já há uma em andamento.
 */
export async function startImport(
  connection: BlingConnection,
  params: ImportOrdersParams,
): Promise<boolean> {
  const existing = importStore.get(connection.id);
  if (existing?.status === "running") {
    return false;
  }

  const progress: ImportProgress = {
    status: "running",
    connectionId: connection.id,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    params,
    currentPage: 0,
    totalFetched: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    cancelRequested: false,
  };

  importStore.set(connection.id, progress);

  // Roda em background — não aguarda
  void runImport(connection, params, progress);

  return true;
}

// ---------------------------------------------------------------------------
// Loop principal de importação
// ---------------------------------------------------------------------------

async function runImport(
  connection: BlingConnection,
  params: ImportOrdersParams,
  progress: ImportProgress,
): Promise<void> {
  let { accessToken, onTokenRefresh } = getAccessTokenAndRefresher(connection);
  const forceUpdate = params.forceUpdate ?? true;
  const companyId = connection.blingCompanyId ?? connection.id;

  console.info(
    `[BlingHistoricalImport] Iniciando importação para conexão ${connection.id} ` +
      `(${params.startDate} → ${params.endDate}, forceUpdate=${forceUpdate})`,
  );

  try {
    let pagina = 1;

    while (true) {
      if (progress.cancelRequested) {
        progress.status = "cancelled";
        progress.finishedAt = new Date().toISOString();
        console.info(
          `[BlingHistoricalImport] Importação cancelada na página ${pagina} (conexão ${connection.id})`,
        );
        return;
      }

      progress.currentPage = pagina;

      // ── Lista pedidos da página atual ──────────────────────────────────────
      const summaries = await getBlingPedidosVendas(
        accessToken,
        {
          pagina,
          limite: PAGE_SIZE,
          dataInicial: params.startDate,
          dataFinal: params.endDate,
          idSituacao: params.idSituacao,
          idLoja: params.idLoja,
        },
        onTokenRefresh,
      );

      if (summaries.length === 0) {
        console.info(
          `[BlingHistoricalImport] Página ${pagina} sem resultados — paginação concluída.`,
        );
        break;
      }

      progress.totalFetched += summaries.length;

      console.info(
        `[BlingHistoricalImport] Página ${pagina}: ${summaries.length} pedido(s) ` +
          `(total buscado: ${progress.totalFetched})`,
      );

      // Delay pós-listagem antes da primeira chamada de detalhe
      await sleep(RATE_LIMIT_DELAY_MS);

      // ── Processa cada pedido da página ─────────────────────────────────────
      for (let i = 0; i < summaries.length; i++) {
        if (progress.cancelRequested) break;

        const summary = summaries[i];

        try {
          await processOrder(
            summary.id,
            connection,
            accessToken,
            onTokenRefresh,
            companyId,
            forceUpdate,
            progress,
          );
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          progress.failed++;
          if (progress.errors.length < MAX_STORED_ERRORS) {
            progress.errors.push({ orderId: summary.id, error: errMsg });
          }
          console.error(
            `[BlingHistoricalImport] Erro ao processar pedido ${summary.id}:`,
            errMsg,
          );
        }

        // Delay entre pedidos (respeitando o rate limit)
        // processOrder já fez 2 chamadas com 350ms entre elas;
        // aqui adicionamos o delay antes do próximo pedido.
        if (i < summaries.length - 1) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      }

      // Última página
      if (summaries.length < PAGE_SIZE) {
        break;
      }

      pagina++;

      // Delay antes de buscar a próxima página
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    progress.status = "completed";
    progress.finishedAt = new Date().toISOString();

    console.info(
      `[BlingHistoricalImport] ✓ Concluído para conexão ${connection.id}. ` +
        `Buscados: ${progress.totalFetched} | ` +
        `Criados: ${progress.created} | ` +
        `Atualizados: ${progress.updated} | ` +
        `Ignorados: ${progress.skipped} | ` +
        `Falhas: ${progress.failed}`,
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    progress.status = "failed";
    progress.finishedAt = new Date().toISOString();
    progress.errors.push({ orderId: 0, error: `Falha geral: ${errMsg}` });

    console.error(
      `[BlingHistoricalImport] Falha catastrófica na importação da conexão ${connection.id}:`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// Processamento de um pedido individual
// ---------------------------------------------------------------------------

async function processOrder(
  orderId: number,
  connection: BlingConnection,
  accessToken: string,
  onTokenRefresh: () => Promise<string>,
  companyId: string,
  forceUpdate: boolean,
  progress: ImportProgress,
): Promise<void> {
  const exists = await orderExistsInDb(orderId, connection.id);

  if (exists && !forceUpdate) {
    progress.skipped++;
    return;
  }

  // 1) Busca detalhes completos do pedido — itens, parcelas, transporte etc.
  const pedido = await getBlingPedidoVenda(
    accessToken,
    orderId,
    onTokenRefresh,
  );

  // Rate limit: aguarda antes da próxima chamada
  await sleep(RATE_LIMIT_DELAY_MS);

  // 2) Busca dados do contato para telefone, celular, tipo e documento
  let contato: BlingContato | null = null;
  try {
    contato = await getBlingContato(
      accessToken,
      pedido.contato.id,
      onTokenRefresh,
    );
  } catch (contactError) {
    console.warn(
      `[BlingHistoricalImport] Contato ${pedido.contato.id} indisponível para pedido ${orderId} — prosseguindo sem enriquecimento:`,
      contactError,
    );
  }

  // 3) Lookup de sellerName no banco (zero API calls), escopo por conexão
  const sellerName = await resolveSellerName(pedido.vendedor?.id ?? null, connection.id);

  // 4) Adapter → SalesOrder (mesmo formato usado pelo webhook)
  const salesOrder = mapPedidoToSalesOrder(pedido, contato, sellerName);

  const eventType: "created" | "updated" = exists ? "updated" : "created";
  const eventId = `import-${connection.id}-${orderId}`;
  const message = buildMessage(
    salesOrder,
    eventType,
    connection,
    eventId,
    companyId,
  );

  // 5) Upsert via blingOrdersService (mesma lógica do webhook)
  if (exists) {
    await blingOrdersService.updateOrder({ message, connectionId: connection.id });
    progress.updated++;
  } else {
    await blingOrdersService.createOrder({ message, connectionId: connection.id });
    progress.created++;
  }

  progress.processed++;
}

// ---------------------------------------------------------------------------
// Utilitário para carregar uma conexão validada do banco
// ---------------------------------------------------------------------------

/**
 * Carrega e valida uma conexão Bling pelo ID.
 * Garante que a conexão pertence ao usuário e está autenticada.
 */
export async function loadValidatedConnection(
  connectionId: string,
  userId: string,
): Promise<BlingConnection | null> {
  const [connection] = await db
    .select()
    .from(blingConnections)
    .where(eq(blingConnections.id, connectionId))
    .limit(1);

  if (!connection || connection.userId !== userId) return null;
  if (!connection.accessTokenEncrypted) return null;

  return connection;
}
