/**
 * Serviço de exportação de clientes do CRM para o Bling como contatos.
 *
 * Busca clientes em lotes de 100, detecta duplicatas no Bling por CPF/telefone,
 * cria ou atualiza cada contato, e salva o blingContactId no banco.
 *
 * Rate limit: respeita o limite de 3 req/s do Bling com 350 ms entre chamadas.
 */

import { db } from "../db";
import {
  clients,
  users,
  blingConnections,
  blingClientSync,
  blingContactMappings,
  blingSellerMappings,
  type BlingConnection,
} from "../../shared/schema";
import { asc, and, eq, ne, sql } from "drizzle-orm";
import {
  getBlingContatos,
  createBlingContato,
  updateBlingContato,
} from "../integrations/bling";
import { getAccessTokenAndRefresher } from "./bling-webhook.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ExportClientsParams {
  /** Quando true, inclui clientes com categoria="Bling" (vindos do webhook). Default: false */
  includeBlingSourced?: boolean;
}

export type ExportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface ExportProgress {
  status: ExportStatus;
  connectionId: string;
  startedAt: string | null;
  finishedAt: string | null;
  params: ExportClientsParams | null;
  currentPage: number;
  totalFetched: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Até 50 erros individuais */
  errors: Array<{ clientId: string; clientName: string; error: string }>;
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

const exportStore = new Map<string, ExportProgress>();

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retorna o CPF/CNPJ somente se for válido para envio ao Bling.
 * Descarta nulos, strings vazias e CPFs sabidamente inválidos (ex: 000.000.000-00).
 */
function sanitizeDocument(cpf: string | null): string | undefined {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 0) return undefined;
  // CPF/CNPJ com todos os dígitos iguais é inválido (000...0, 111...1 etc.)
  if (/^(\d)\1+$/.test(digits)) return undefined;
  return cpf;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Retorna o estado atual da exportação para uma conexão.
 * Se nunca foi iniciada, retorna estado "idle".
 */
export function getExportStatus(connectionId: string): ExportProgress {
  return (
    exportStore.get(connectionId) ?? {
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
 * Solicita o cancelamento de uma exportação em andamento.
 * O cancelamento é cooperativo — para no próximo ponto de checagem.
 */
export function cancelExport(connectionId: string): boolean {
  const progress = exportStore.get(connectionId);
  if (!progress || progress.status !== "running") return false;
  progress.cancelRequested = true;
  return true;
}

/**
 * Inicia a exportação de clientes para o Bling em background.
 *
 * @returns true se iniciada, false se já há uma em andamento.
 */
export async function startExport(
  connection: BlingConnection,
  params: ExportClientsParams,
): Promise<boolean> {
  const existing = exportStore.get(connection.id);
  if (existing?.status === "running") {
    return false;
  }

  const progress: ExportProgress = {
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

  exportStore.set(connection.id, progress);

  // Roda em background — não aguarda
  void runExport(connection, params, progress);

  return true;
}

// ---------------------------------------------------------------------------
// Loop principal de exportação
// ---------------------------------------------------------------------------

async function runExport(
  connection: BlingConnection,
  params: ExportClientsParams,
  progress: ExportProgress,
): Promise<void> {
  let { accessToken, onTokenRefresh } = getAccessTokenAndRefresher(connection);
  const includeBlingSourced = params.includeBlingSourced ?? false;

  console.info(
    `[BlingClientsExport] Iniciando exportação para conexão ${connection.id} ` +
      `(includeBlingSourced=${includeBlingSourced})`,
  );

  try {
    let page = 1;

    while (true) {
      if (progress.cancelRequested) {
        progress.status = "cancelled";
        progress.finishedAt = new Date().toISOString();
        console.info(
          `[BlingClientsExport] Exportação cancelada na página ${page} (conexão ${connection.id})`,
        );
        return;
      }

      progress.currentPage = page;

      // ── Busca lote de clientes com JOINs multi-conta ───────────────────────
      const batch = await db
        .select({
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          fixedPhone: clients.fixedPhone,
          cpf: clients.cpf,
          email: clients.email,
          birthday: clients.birthday,
          cep: clients.cep,
          address: clients.address,
          number: clients.number,
          neighborhood: clients.neighborhood,
          state: clients.state,
          // blingContactId desta conexão específica
          blingContactId: blingContactMappings.blingContactId,
          // blingVendedorId do responsável nesta conexão (multi-conta)
          blingVendedorId: blingSellerMappings.blingVendedorId,
        })
        .from(clients)
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .leftJoin(
          blingContactMappings,
          and(
            eq(blingContactMappings.clientId, clients.id),
            eq(blingContactMappings.connectionId, connection.id),
          ),
        )
        .leftJoin(
          blingSellerMappings,
          and(
            eq(blingSellerMappings.userId, users.id),
            eq(blingSellerMappings.connectionId, connection.id),
          ),
        )
        .where(includeBlingSourced ? undefined : ne(clients.categoria, "Bling"))
        .orderBy(asc(clients.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE);

      if (batch.length === 0) {
        console.info(
          `[BlingClientsExport] Página ${page} sem resultados — exportação concluída.`,
        );
        break;
      }

      progress.totalFetched += batch.length;

      console.info(
        `[BlingClientsExport] Página ${page}: ${batch.length} cliente(s) ` +
          `(total buscado: ${progress.totalFetched})`,
      );

      // ── Processa cada cliente do lote ──────────────────────────────────────
      for (let i = 0; i < batch.length; i++) {
        if (progress.cancelRequested) break;

        const client = batch[i];

        try {
          await processClient(
            client,
            accessToken,
            onTokenRefresh,
            progress,
            connection.id,
          );
          await markSynced(client.id);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          progress.failed++;
          if (progress.errors.length < MAX_STORED_ERRORS) {
            progress.errors.push({
              clientId: client.id,
              clientName: client.name,
              error: errMsg,
            });
          }
          await markSyncError(client.id, errMsg);
          console.error(
            `[BlingClientsExport] Erro ao exportar cliente ${client.id} (${client.name}):`,
            errMsg,
          );
        }

        // Delay entre clientes (respeitando rate limit)
        if (i < batch.length - 1) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      }

      if (batch.length < PAGE_SIZE) {
        break;
      }

      page++;
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    progress.status = "completed";
    progress.finishedAt = new Date().toISOString();

    console.info(
      `[BlingClientsExport] ✓ Concluído para conexão ${connection.id}. ` +
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
    if (progress.errors.length < MAX_STORED_ERRORS) {
      progress.errors.push({
        clientId: "",
        clientName: "",
        error: `Falha geral: ${errMsg}`,
      });
    }

    console.error(
      `[BlingClientsExport] Falha catastrófica na exportação da conexão ${connection.id}:`,
      error,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers de persistência de status de sincronização
// ---------------------------------------------------------------------------

async function markSynced(clientId: string): Promise<void> {
  await db
    .insert(blingClientSync)
    .values({
      clientId,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      errorMessage: null,
    })
    .onConflictDoUpdate({
      target: blingClientSync.clientId,
      set: {
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
}

async function markSyncError(clientId: string, errorMessage: string): Promise<void> {
  await db
    .insert(blingClientSync)
    .values({
      clientId,
      syncStatus: "error",
      errorMessage,
      retryCount: 1,
    })
    .onConflictDoUpdate({
      target: blingClientSync.clientId,
      set: {
        syncStatus: "error",
        errorMessage,
        retryCount: sql`${blingClientSync.retryCount} + 1`,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Processamento de um cliente individual
// ---------------------------------------------------------------------------

type ClientBatch = {
  id: string;
  name: string;
  phone: string | null;
  fixedPhone: string | null;
  cpf: string | null;
  email: string | null;
  birthday: string | null;
  cep: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  state: string | null;
  /** blingContactId desta conexão (blingContactMappings); null se ainda não sincronizado */
  blingContactId: string | null;
  /** blingVendedorId do responsável nesta conexão (blingSellerMappings); fallback para users.blingVendedorId */
  blingVendedorId: string | null;
};

async function processClient(
  client: ClientBatch,
  accessToken: string,
  onTokenRefresh: () => Promise<string>,
  progress: ExportProgress,
  connectionId: string,
): Promise<void> {
  let blingContactId = client.blingContactId;

  // ── 1. Detectar duplicata no Bling (se ainda não temos o ID) ─────────────
  if (!blingContactId) {
    let existingId: number | null = null;

    // Busca por CPF primeiro
    const validCpf = sanitizeDocument(client.cpf);
    if (validCpf) {
      const results = await getBlingContatos(
        accessToken,
        { numeroDocumento: validCpf },
        onTokenRefresh,
      );
      await sleep(RATE_LIMIT_DELAY_MS);
      if (results.length > 0 && results[0]) {
        existingId = results[0].id;
      }
    }

    // Busca por telefone se CPF não achou
    if (!existingId && client.phone) {
      const results = await getBlingContatos(
        accessToken,
        { telefone: client.phone },
        onTokenRefresh,
      );
      await sleep(RATE_LIMIT_DELAY_MS);
      if (results.length > 0 && results[0]) {
        existingId = results[0].id;
      }
    }

    // Salva mapeamento e atualiza variável local
    if (existingId !== null) {
      blingContactId = String(existingId);
      await db
        .insert(blingContactMappings)
        .values({ connectionId, blingContactId, clientId: client.id })
        .onConflictDoNothing();
      // Retrocompatibilidade: mantém clients.blingContactId para código legado
      await db
        .update(clients)
        .set({ blingContactId })
        .where(eq(clients.id, client.id));
    }
  }

  // ── 2. Montar payload ─────────────────────────────────────────────────────
  const vendedorId = client.blingVendedorId
    ? Number(client.blingVendedorId)
    : null;

  const payload = {
    nome: client.name,
    tipo: "F" as const,
    situacao: "A" as const,
    numeroDocumento: sanitizeDocument(client.cpf),
    telefone: client.fixedPhone ?? undefined,
    celular: client.phone ?? undefined,
    email: client.email ?? undefined,
    vendedor: vendedorId ? { id: vendedorId } : undefined,
    endereco: {
      geral: {
        endereco: client.address ?? undefined,
        numero: client.number ?? undefined,
        bairro: client.neighborhood ?? undefined,
        // municipio omitido: o Bling valida contra cadastro oficial de municípios
        // e rejeita nomes que não correspondem exatamente
        uf: client.state ?? undefined,
        cep: client.cep ?? undefined,
      },
    },
    dadosAdicionais: client.birthday
      ? { dataNascimento: client.birthday }
      : undefined,
  };

  // ── 3. Criar ou atualizar no Bling ────────────────────────────────────────
  if (blingContactId) {
    await updateBlingContato(
      accessToken,
      Number(blingContactId),
      payload,
      onTokenRefresh,
    );
    progress.updated++;
  } else {
    const { id } = await createBlingContato(accessToken, payload, onTokenRefresh);
    blingContactId = String(id);

    // Salva mapeamento por conexão
    await db
      .insert(blingContactMappings)
      .values({ connectionId, blingContactId, clientId: client.id })
      .onConflictDoNothing();

    // Retrocompatibilidade: mantém clients.blingContactId para código legado
    await db
      .update(clients)
      .set({ blingContactId })
      .where(eq(clients.id, client.id));

    progress.created++;
  }

  progress.processed++;
}

// ---------------------------------------------------------------------------
// Sincronização individual de um cliente para o Bling
// ---------------------------------------------------------------------------

/**
 * Sincroniza um único cliente do CRM para o Bling como contato.
 *
 * Usa a primeira conexão Bling com status "connected". Se não houver nenhuma,
 * retorna silenciosamente. Erros de API são propagados para o chamador.
 *
 * @param clientId - ID do cliente no CRM.
 */
export async function syncClientToBling(clientId: string): Promise<void> {
  const [connection] = await db
    .select()
    .from(blingConnections)
    .where(eq(blingConnections.status, "connected"))
    .limit(1);

  if (!connection?.accessTokenEncrypted) return;

  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      fixedPhone: clients.fixedPhone,
      cpf: clients.cpf,
      email: clients.email,
      birthday: clients.birthday,
      cep: clients.cep,
      address: clients.address,
      number: clients.number,
      neighborhood: clients.neighborhood,
      state: clients.state,
      blingContactId: blingContactMappings.blingContactId,
      blingVendedorId: blingSellerMappings.blingVendedorId,
    })
    .from(clients)
    .leftJoin(users, eq(clients.responsavelId, users.id))
    .leftJoin(
      blingContactMappings,
      and(
        eq(blingContactMappings.clientId, clients.id),
        eq(blingContactMappings.connectionId, connection.id),
      ),
    )
    .leftJoin(
      blingSellerMappings,
      and(
        eq(blingSellerMappings.userId, users.id),
        eq(blingSellerMappings.connectionId, connection.id),
      ),
    )
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return;

  const { accessToken, onTokenRefresh } = getAccessTokenAndRefresher(connection);

  const stub: ExportProgress = {
    status: "running",
    connectionId: connection.id,
    startedAt: null,
    finishedAt: null,
    params: null,
    currentPage: 1,
    totalFetched: 1,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    cancelRequested: false,
  };

  try {
    await processClient(client, accessToken, onTokenRefresh, stub, connection.id);
    await markSynced(clientId);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await markSyncError(clientId, errMsg);
    throw error;
  }

  console.info(
    `[Bling] Cliente ${clientId} sincronizado (criados: ${stub.created}, atualizados: ${stub.updated})`,
  );
}
