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
  BlingApiError,
} from "../integrations/bling";
import { getAccessTokenAndRefresher } from "./bling-webhook.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface ExportClientsParams {
  /** Quando true, inclui clientes com categoria="Bling" (vindos do webhook). Default: false */
  includeBlingSourced?: boolean;
  /** Quando informado, exporta apenas clientes com esse responsavelId */
  responsavelId?: string;
}

export type ExportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type RecentExportItemStatus = "created" | "updated" | "failed";

export interface RecentExportItem {
  clientId: string;
  clientName: string;
  status: RecentExportItemStatus;
  /** Nome do vendedor Bling vinculado ao contato, ou null se sem vínculo */
  vendorName: string | null;
  errorMessage?: string;
}

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
  /** Total de contatos exportados com vínculo de vendedor */
  vendorLinksCreated: number;
  /** Nome do cliente sendo processado no momento */
  currentClient: string | null;
  /** Feed dos últimos 30 itens processados */
  recentItems: RecentExportItem[];
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
const MAX_RECENT_ITEMS = 30;

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
function sanitizeDocument(doc: string | null): string | undefined {
  if (!doc) return undefined;
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 0) return undefined;
  // CPF/CNPJ com todos os dígitos iguais é inválido (000...0, 111...1 etc.)
  if (/^(\d)\1+$/.test(digits)) return undefined;
  return digits; // Bling espera só dígitos no payload
}

/**
 * Normaliza telefone para o formato que o Bling aceita no payload: (xx) xxxxx-xxxx.
 * Remove +55, caracteres não-dígito e formata conforme o número de dígitos.
 */
function sanitizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  let d = phone.replace(/\D/g, "");
  // Remove prefixo +55 (Brasil)
  if ((d.length === 13 || d.length === 12) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 0) return undefined;
  // Número fora do padrão — retorna só dígitos (evita enviar mask chars ou +55)
  return d;
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
      vendorLinksCreated: 0,
      currentClient: null,
      recentItems: [],
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
    vendorLinksCreated: 0,
    currentClient: null,
    recentItems: [],
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
  const responsavelId = params.responsavelId ?? null;

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
          cnpj: clients.cnpj,
          documentType: clients.documentType,
          email: clients.email,
          birthday: clients.birthday,
          cep: clients.cep,
          address: clients.address,
          number: clients.number,
          neighborhood: clients.neighborhood,
          state: clients.state,
          // blingContactId desta conexão específica
          blingContactId: blingContactMappings.blingContactId,
          // blingVendedorId e nome do responsável nesta conexão (multi-conta)
          blingVendedorId: blingSellerMappings.blingVendedorId,
          blingVendedorName: blingSellerMappings.blingVendedorName,
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
        .where(
          and(
            includeBlingSourced ? undefined : ne(clients.categoria, "Bling"),
            responsavelId ? eq(clients.responsavelId, responsavelId) : undefined,
          ),
        )
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

        progress.currentClient = client.name;

        try {
          const action = await processClient(
            client,
            accessToken,
            onTokenRefresh,
            progress,
            connection.id,
          );
          await markSynced(client.id);

          const vendorName = client.blingVendedorName ?? null;
          if (vendorName) progress.vendorLinksCreated++;

          if (progress.recentItems.length >= MAX_RECENT_ITEMS) {
            progress.recentItems.shift();
          }
          progress.recentItems.push({
            clientId: client.id,
            clientName: client.name,
            status: action,
            vendorName,
          });
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
          if (progress.recentItems.length >= MAX_RECENT_ITEMS) {
            progress.recentItems.shift();
          }
          progress.recentItems.push({
            clientId: client.id,
            clientName: client.name,
            status: "failed",
            vendorName: client.blingVendedorName ?? null,
            errorMessage: errMsg,
          });
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

    progress.currentClient = null;
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
  cnpj: string | null;
  documentType: string | null;
  email: string | null;
  birthday: string | null;
  cep: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  state: string | null;
  /** blingContactId desta conexão (blingContactMappings); null se ainda não sincronizado */
  blingContactId: string | null;
  /** blingVendedorId do responsável nesta conexão (blingSellerMappings) */
  blingVendedorId: string | null;
  /** Nome do vendedor Bling para exibição no feedback */
  blingVendedorName: string | null;
};

async function processClient(
  client: ClientBatch,
  accessToken: string,
  onTokenRefresh: () => Promise<string>,
  progress: ExportProgress,
  connectionId: string,
): Promise<"created" | "updated"> {
  let blingContactId = client.blingContactId;

  // ── 1. Detectar duplicata no Bling (se ainda não temos o ID) ─────────────
  if (!blingContactId) {
    let existingId: number | null = null;

    // Busca por CPF/CNPJ primeiro
    const docParaBusca = client.documentType === "cnpj" ? client.cnpj : client.cpf;
    const validCpf = sanitizeDocument(docParaBusca);
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

  const isCnpj = client.documentType === "cnpj";
  const payload = {
    nome: client.name,
    tipo: (isCnpj ? "J" : "F") as "F" | "J",
    situacao: "A" as const,
    numeroDocumento: sanitizeDocument(isCnpj ? client.cnpj : client.cpf),
    telefone: sanitizePhone(client.fixedPhone),
    celular: sanitizePhone(client.phone),
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
  let action: "created" | "updated";

  if (blingContactId) {
    await updateBlingContato(
      accessToken,
      Number(blingContactId),
      payload,
      onTokenRefresh,
    );
    progress.updated++;
    action = "updated";
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
    action = "created";
  }

  progress.processed++;
  return action;
}

// ---------------------------------------------------------------------------
// Sincronização individual de um cliente para o Bling
// ---------------------------------------------------------------------------

/**
 * Erro de sincronização individual com mensagem segura e amigável já pronta
 * para exibição ao usuário (`userMessage`) e o status HTTP correspondente.
 * O detalhe técnico completo permanece em `message`/`cause` (apenas logs).
 */
export class BlingSyncError extends Error {
  readonly userMessage: string;
  readonly httpStatus: number;

  constructor(
    userMessage: string,
    httpStatus: number,
    technicalMessage?: string,
  ) {
    super(technicalMessage ?? userMessage);
    this.name = "BlingSyncError";
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
  }
}

/**
 * Traduz uma falha da API do Bling em `BlingSyncError` com mensagem segura.
 * Nunca expõe token, IDs internos ou stack — apenas mensagens curadas (e, no
 * caso de validação, as mensagens por campo retornadas pelo próprio Bling sobre
 * os dados do cliente, que são seguras de exibir).
 */
function toBlingSyncError(error: unknown): BlingSyncError {
  if (error instanceof BlingSyncError) return error;

  if (error instanceof BlingApiError) {
    const technical = error.message;

    if (error.status === 401 || error.status === 403) {
      return new BlingSyncError(
        "A conexão com o Bling expirou. Reconecte a conta nas Configurações.",
        502,
        technical,
      );
    }

    if (error.status === 429) {
      return new BlingSyncError(
        "O Bling está limitando as requisições no momento. Tente novamente em alguns instantes.",
        429,
        technical,
      );
    }

    if (error.status === 400 || error.status === 422) {
      // A mensagem de BlingApiError já vem formatada por campo (formatBlingApiError),
      // sobre os próprios dados do cliente — seguro exibir. Removemos o prefixo técnico.
      const detail = technical.replace(/^Falha ao (criar|atualizar) contato no Bling:\s*/i, "");
      return new BlingSyncError(
        `O Bling recusou os dados do cliente: ${detail}`,
        422,
        technical,
      );
    }

    return new BlingSyncError(
      "Não foi possível sincronizar com o Bling. Tente novamente; se persistir, contate o suporte.",
      502,
      technical,
    );
  }

  return new BlingSyncError(
    "Não foi possível sincronizar com o Bling. Tente novamente; se persistir, contate o suporte.",
    500,
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Sincroniza um único cliente do CRM para o Bling como contato.
 *
 * Quando `connectionId` é informado, usa essa conexão específica (deve estar com
 * status "connected") e exige que o responsável do cliente tenha vínculo de
 * vendedor Bling nela. Sem `connectionId`, usa a primeira conexão "connected"
 * (comportamento legado). Lança `BlingSyncError` (com mensagem segura ao usuário)
 * quando não há conexão ativa, o cliente não existe, falta o vínculo de vendedor,
 * ou a API do Bling falha.
 *
 * @param clientId - ID do cliente no CRM.
 * @param connectionId - ID opcional da conexão Bling alvo.
 */
export async function syncClientToBling(
  clientId: string,
  connectionId?: string,
): Promise<void> {
  const [connection] = connectionId
    ? await db
        .select()
        .from(blingConnections)
        .where(
          and(
            eq(blingConnections.id, connectionId),
            eq(blingConnections.status, "connected"),
          ),
        )
        .limit(1)
    : await db
        .select()
        .from(blingConnections)
        .where(eq(blingConnections.status, "connected"))
        .limit(1);

  if (!connection?.accessTokenEncrypted) {
    throw new BlingSyncError(
      connectionId
        ? "A conta Bling selecionada não está conectada. Reconecte-a nas Configurações."
        : "Nenhuma conexão com o Bling está ativa. Reconecte a conta nas Configurações.",
      409,
      "Nenhuma conexão Bling com status 'connected' e access token disponível.",
    );
  }

  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      fixedPhone: clients.fixedPhone,
      cpf: clients.cpf,
      cnpj: clients.cnpj,
      documentType: clients.documentType,
      email: clients.email,
      birthday: clients.birthday,
      cep: clients.cep,
      address: clients.address,
      number: clients.number,
      neighborhood: clients.neighborhood,
      state: clients.state,
      blingContactId: blingContactMappings.blingContactId,
      blingVendedorId: blingSellerMappings.blingVendedorId,
      blingVendedorName: blingSellerMappings.blingVendedorName,
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

  if (!client) {
    throw new BlingSyncError(
      "Cliente não encontrado.",
      404,
      `Cliente ${clientId} não encontrado ao sincronizar com o Bling.`,
    );
  }

  // Quando a conta é escolhida explicitamente, o responsável precisa ter um
  // vínculo de vendedor Bling nessa conta — sem ele, não criamos no Bling.
  if (connectionId && !client.blingVendedorId) {
    throw new BlingSyncError(
      "O responsável não possui um vendedor Bling vinculado a esta conta.",
      422,
      `Cliente ${clientId} sem blingVendedorId na conexão ${connectionId}.`,
    );
  }

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
    vendorLinksCreated: 0,
    currentClient: null,
    recentItems: [],
    errors: [],
    cancelRequested: false,
  };

  try {
    await processClient(client, accessToken, onTokenRefresh, stub, connection.id);
    await markSynced(clientId);
  } catch (error) {
    const syncError = toBlingSyncError(error);
    // Log com o detalhe técnico completo (apenas server-side).
    console.error(
      `[Bling] Falha ao sincronizar cliente ${clientId}:`,
      syncError.message,
    );
    await markSyncError(clientId, syncError.message);
    throw syncError;
  }

  console.info(
    `[Bling] Cliente ${clientId} sincronizado (criados: ${stub.created}, atualizados: ${stub.updated})`,
  );
}
