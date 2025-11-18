import { db } from "../db";
import {
  cashbackTransactions,
  clientCashbackBalance,
  cashbackSettings,
  clients,
  users,
  cashbackUsage,
} from "../../shared/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";

/**
 * Interface para transação de cashback com dados do cliente
 */
export interface CashbackTransactionWithClient {
  id: string;
  clientId: string | null;
  dealId: string | null;
  purchaseAmount: string;
  cashbackAmount: string;
  cashbackRate: string;
  status: string;
  expiresAt: Date | null;
  processedBy: string | null;
  settingId: string | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  clientName?: string | null;
  clientEmail?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
}

/**
 * Interface para saldo de cashback com dados do cliente
 */
export interface ClientCashbackBalanceWithClient {
  id: string;
  clientId: string;
  currentBalance: string;
  totalEarned: string;
  totalUsed: string;
  lastUpdated: Date | null;
  clientName?: string | null;
  clientEmail?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
}

/**
 * Repository responsável por operações de estatísticas de cashback
 */
class CashbackStatisticsRepository {
  /**
   * Busca todas as transações de cashback com dados dos clientes
   *
   * @param userId - ID do usuário (opcional, para filtrar por vendedor)
   * @param userRole - Role do usuário (opcional, se for vendedor filtra apenas seus clientes)
   * @returns Lista de transações com dados dos clientes
   *
   * @example
   * const transactions = await repository.getCashbackTransactions();
   * const vendorTransactions = await repository.getCashbackTransactions("user-id", "vendedor");
   *
   * @notes
   * - Se userRole for "vendedor", retorna apenas transações de clientes sob responsabilidade do userId
   * - Faz join com clients e users para trazer nome do cliente e responsável
   * - Ordenado por data de criação
   */
  async getCashbackTransactions(
    userId?: string,
    userRole?: string
  ): Promise<CashbackTransactionWithClient[]> {
    let query = db
      .select({
        transactionId: cashbackTransactions.id,
        clientId: cashbackTransactions.clientId,
        dealId: cashbackTransactions.dealId,
        purchaseAmount: cashbackTransactions.purchaseAmount,
        cashbackAmount: cashbackTransactions.cashbackAmount,
        cashbackRate: cashbackTransactions.cashbackRate,
        status: cashbackTransactions.status,
        expiresAt: cashbackTransactions.expiresAt,
        processedBy: cashbackTransactions.processedBy,
        settingId: cashbackTransactions.settingId,
        notes: cashbackTransactions.notes,
        createdAt: cashbackTransactions.createdAt,
        updatedAt: cashbackTransactions.updatedAt,
        clientName: clients.name,
        clientEmail: clients.email,
        responsibleId: users.id,
        responsibleName: users.name,
      })
      .from(cashbackTransactions)
      .leftJoin(clients, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId));

    // Filtrar por vendedor se aplicável
    if (userRole === "vendedor" && userId) {
      query = query.where(eq(clients.responsavelId, userId)) as any;
    }

    const rawTransactions = await query.orderBy(cashbackTransactions.createdAt);

    // Transformar para o formato esperado
    return rawTransactions.map((row) => ({
      id: row.transactionId!,
      clientId: row.clientId,
      dealId: row.dealId,
      purchaseAmount: row.purchaseAmount!,
      cashbackAmount: row.cashbackAmount!,
      cashbackRate: row.cashbackRate!,
      status: row.status!,
      expiresAt: row.expiresAt,
      processedBy: row.processedBy,
      settingId: row.settingId,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      responsibleId: row.responsibleId,
      responsibleName: row.responsibleName,
    }));
  }

  /**
   * Busca todos os saldos de cashback com dados dos clientes
   *
   * @param userId - ID do usuário (opcional, para filtrar por vendedor)
   * @param userRole - Role do usuário (opcional, se for vendedor filtra apenas seus clientes)
   * @returns Lista de saldos com dados dos clientes
   *
   * @example
   * const balances = await repository.getAllCashbackBalances();
   * const vendorBalances = await repository.getAllCashbackBalances("user-id", "vendedor");
   *
   * @notes
   * - Se userRole for "vendedor", retorna apenas saldos de clientes sob responsabilidade do userId
   * - Faz join com clients e users para trazer nome do cliente e responsável
   */
  async getAllCashbackBalances(
    userId?: string,
    userRole?: string
  ): Promise<ClientCashbackBalanceWithClient[]> {
    let query = db
      .select({
        balanceId: clientCashbackBalance.id,
        clientId: clientCashbackBalance.clientId,
        currentBalance: clientCashbackBalance.currentBalance,
        totalEarned: clientCashbackBalance.totalEarned,
        totalUsed: clientCashbackBalance.totalUsed,
        lastUpdated: clientCashbackBalance.lastUpdated,
        clientName: clients.name,
        clientEmail: clients.email,
        responsibleId: users.id,
        responsibleName: users.name,
      })
      .from(clientCashbackBalance)
      .leftJoin(clients, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId));

    // Filtrar por vendedor se aplicável
    if (userRole === "vendedor" && userId) {
      query = query.where(eq(clients.responsavelId, userId)) as any;
    }

    const rawBalances = await query;

    // Transformar para o formato esperado
    return rawBalances.map((row) => ({
      id: row.balanceId!,
      clientId: row.clientId!,
      currentBalance: row.currentBalance!,
      totalEarned: row.totalEarned!,
      totalUsed: row.totalUsed!,
      lastUpdated: row.lastUpdated,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      responsibleId: row.responsibleId,
      responsibleName: row.responsibleName,
    }));
  }

  /**
   * Busca todas as configurações de cashback
   *
   * @returns Lista de configurações
   *
   * @example
   * const settings = await repository.getCashbackSettings();
   */
  async getCashbackSettings() {
    return await db
      .select()
      .from(cashbackSettings)
      .orderBy(cashbackSettings.createdAt);
  }

  /**
   * Busca cashbacks que estão próximos de expirar (próximos 7 dias)
   *
   * @param search - Termo de busca opcional (nome do cliente, vendedor, telefone, CPF)
   * @param sortBy - Campo para ordenação (amount, expiresAt, clientName, sellerName)
   * @param sortOrder - Direção da ordenação (asc, desc)
   * @param limit - Limite de registros (máximo 100)
   * @param offset - Offset para paginação
   * @returns Lista de cashbacks expirando com dados relacionados
   *
   * @example
   * const expiring = await repository.getExpiringCashbacks();
   * const filtered = await repository.getExpiringCashbacks("João", "expiresAt", "asc", 20, 0);
   *
   * @notes
   * - Retorna apenas cashbacks com status "approved"
   * - Filtra por data de expiração entre hoje e 7 dias
   * - Inclui dados do cliente e vendedor responsável
   * - Suporta busca por nome, telefone e CPF
   */
  async getExpiringCashbacks(
    search?: string,
    sortBy: "amount" | "expiresAt" | "clientName" | "sellerName" = "expiresAt",
    sortOrder: "asc" | "desc" = "asc",
    limit: number = 50,
    offset: number = 0
  ) {
    const { eq, and, gte, lte, ilike, or, asc, desc, sql } = await import(
      "drizzle-orm"
    );

    // Calcular datas
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    today.setHours(0, 0, 0, 0);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    // Query base
    let query = db
      .select({
        id: cashbackTransactions.id,
        cashbackAmount: cashbackTransactions.cashbackAmount,
        purchaseAmount: cashbackTransactions.purchaseAmount,
        cashbackRate: cashbackTransactions.cashbackRate,
        expiresAt: cashbackTransactions.expiresAt,
        status: cashbackTransactions.status,
        notes: cashbackTransactions.notes,
        createdAt: cashbackTransactions.createdAt,
        clientId: clients.id,
        clientName: clients.name,
        clientPhone: clients.phone,
        clientCpf: clients.cpf,
        clientEmail: clients.email,
        sellerId: users.id,
        sellerName: users.name,
        sellerEmail: users.email,
      })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId))
      .where(
        and(
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow)
        )
      );

    // Aplicar filtro de busca
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.where(
        and(
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow),
          or(
            ilike(clients.name, searchTerm),
            ilike(users.name, searchTerm),
            ilike(clients.phone, searchTerm),
            ilike(clients.cpf, searchTerm)
          )
        )
      ) as any;
    }

    // Ordenação
    const orderColumn = (() => {
      switch (sortBy) {
        case "amount":
          return cashbackTransactions.cashbackAmount;
        case "expiresAt":
          return cashbackTransactions.expiresAt;
        case "clientName":
          return clients.name;
        case "sellerName":
          return users.name;
        default:
          return cashbackTransactions.expiresAt;
      }
    })();

    const orderDirection =
      sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);
    query = query.orderBy(orderDirection) as any;

    // Paginação
    const limitNum = Math.min(limit, 100);
    query = query.limit(limitNum).offset(offset) as any;

    const result = await query;

    // Contar total
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId))
      .where(
        and(
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow),
          search && search.trim()
            ? or(
                ilike(clients.name, `%${search.trim()}%`),
                ilike(users.name, `%${search.trim()}%`),
                ilike(clients.phone, `%${search.trim()}%`),
                ilike(clients.cpf, `%${search.trim()}%`)
              )
            : undefined
        )
      );

    const [{ count }] = await countQuery;

    return { data: result, total: count, today };
  }

  /**
   * Busca saldos de cashback com filtros avançados
   *
   * @param search - Termo de busca (nome, CPF, telefone, email, vendedor)
   * @param userId - ID do vendedor responsável (ou "all" para todos)
   * @param minBalance - Saldo mínimo
   * @param maxBalance - Saldo máximo
   * @param sortBy - Campo para ordenação (clientName, currentBalance, totalEarned, totalUsed, sellerName, lastUpdated)
   * @param sortOrder - Direção da ordenação (asc, desc)
   * @param limit - Limite de registros (máximo 100)
   * @param offset - Offset para paginação
   * @returns Lista de saldos com dados relacionados, total de registros e estatísticas agregadas
   *
   * @example
   * const result = await repository.getCashbackBalances();
   * const filtered = await repository.getCashbackBalances("João", "user-123", "100", "1000", "currentBalance", "desc", 20, 0);
   *
   * @notes
   * - Faz join com clients e users para trazer dados completos
   * - Suporta busca por múltiplos campos com ilike
   * - Retorna estatísticas agregadas (total de clientes, saldos, médias)
   * - Inclui paginação e contagem total
   */
  async getCashbackBalances(
    search?: string,
    userId?: string,
    minBalance?: string,
    maxBalance?: string,
    sortBy:
      | "clientName"
      | "currentBalance"
      | "totalEarned"
      | "totalUsed"
      | "sellerName"
      | "lastUpdated" = "currentBalance",
    sortOrder: "asc" | "desc" = "desc",
    limit: number = 20,
    offset: number = 0
  ) {
    const { eq, and, gte, lte, ilike, or, asc, desc, sql } = await import(
      "drizzle-orm"
    );

    // Array para armazenar condições WHERE
    const whereConditions: any[] = [];

    // Filtro por busca (nome do cliente, CPF, telefone, email ou vendedor)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.cpf, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(users.name, searchTerm)
        )
      );
    }

    // Filtro por vendedor responsável
    if (userId && userId !== "all") {
      whereConditions.push(eq(clients.responsavelId, userId));
    }

    // Filtro por saldo mínimo
    if (minBalance) {
      whereConditions.push(
        gte(clientCashbackBalance.currentBalance, minBalance)
      );
    }

    // Filtro por saldo máximo
    if (maxBalance) {
      whereConditions.push(
        lte(clientCashbackBalance.currentBalance, maxBalance)
      );
    }

    // Determinar ordenação
    const orderColumn = (() => {
      switch (sortBy) {
        case "clientName":
          return clients.name;
        case "currentBalance":
          return clientCashbackBalance.currentBalance;
        case "totalEarned":
          return clientCashbackBalance.totalEarned;
        case "totalUsed":
          return clientCashbackBalance.totalUsed;
        case "sellerName":
          return users.name;
        case "lastUpdated":
          return clientCashbackBalance.lastUpdated;
        default:
          return clientCashbackBalance.currentBalance;
      }
    })();

    const orderDirection =
      sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);

    // Aplicar paginação
    const limitNum = Math.min(limit, 100);

    // Query principal com todas as condições
    const query = db
      .select({
        // Dados do saldo de cashback
        id: clientCashbackBalance.id,
        clientId: clientCashbackBalance.clientId,
        currentBalance: clientCashbackBalance.currentBalance,
        totalEarned: clientCashbackBalance.totalEarned,
        totalUsed: clientCashbackBalance.totalUsed,
        lastUpdated: clientCashbackBalance.lastUpdated,

        // Dados do cliente
        clientName: clients.name,
        clientCpf: clients.cpf,
        clientPhone: clients.phone,
        clientEmail: clients.email,

        // Dados do vendedor responsável
        sellerId: users.id,
        sellerName: users.name,
        sellerEmail: users.email,
      })
      .from(clientCashbackBalance)
      .innerJoin(clients, eq(clientCashbackBalance.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(orderDirection)
      .limit(limitNum)
      .offset(offset);

    // Executar query principal
    const result = await query;

    // Query para contar total de registros (com os mesmos filtros)
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(clientCashbackBalance)
      .innerJoin(clients, eq(clientCashbackBalance.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const [{ count }] = await countQuery;

    // Query para estatísticas resumidas (com os mesmos filtros)
    const statsQuery = db
      .select({
        totalClients: sql<number>`count(*)`,
        totalCurrentBalance: sql<number>`coalesce(sum(${clientCashbackBalance.currentBalance}), 0)`,
        totalEarnedEver: sql<number>`coalesce(sum(${clientCashbackBalance.totalEarned}), 0)`,
        totalUsedEver: sql<number>`coalesce(sum(${clientCashbackBalance.totalUsed}), 0)`,
        averageBalance: sql<number>`coalesce(avg(${clientCashbackBalance.currentBalance}), 0)`,
      })
      .from(clientCashbackBalance)
      .innerJoin(clients, eq(clientCashbackBalance.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const [stats] = await statsQuery;

    return { data: result, total: count, statistics: stats };
  }

  /**
   * Busca transações de cashback com filtros avançados
   *
   * @param search - Termo de busca (nome, CPF, telefone, email, número da nota)
   * @param status - Status da transação (pending, approved, paid, cancelled, all)
   * @param userId - ID do vendedor responsável (ou "all" para todos)
   * @param startDate - Data inicial de venda
   * @param endDate - Data final de venda
   * @param minAmount - Valor mínimo de cashback
   * @param maxAmount - Valor máximo de cashback
   * @param sortBy - Campo para ordenação (clientName, cashbackAmount, purchaseAmount, cashbackRate, saleDate, status, createdAt)
   * @param sortOrder - Direção da ordenação (asc, desc)
   * @param limit - Limite de registros (máximo 100)
   * @param offset - Offset para paginação
   * @returns Lista de transações com dados relacionados, total de registros e estatísticas agregadas
   *
   * @example
   * const result = await repository.getCashbackTransactionsList();
   * const filtered = await repository.getCashbackTransactionsList("João", "approved", "user-123", "2023-01-01", "2023-12-31", "10", "100", "createdAt", "desc", 20, 0);
   *
   * @notes
   * - Faz join com clients, users (responsável e processador)
   * - Suporta busca por múltiplos campos com like/ilike
   * - Retorna estatísticas agregadas (totais, médias, contagens por status)
   * - Inclui paginação e contagem total
   */
  async getCashbackTransactionsList(
    search?: string,
    status?: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
    minAmount?: string,
    maxAmount?: string,
    sortBy:
      | "clientName"
      | "cashbackAmount"
      | "purchaseAmount"
      | "cashbackRate"
      | "saleDate"
      | "status"
      | "createdAt" = "createdAt",
    sortOrder: "asc" | "desc" = "desc",
    limit: number = 20,
    offset: number = 0
  ) {
    const { eq, and, like, or, gte, lte, asc, desc, sql } = await import(
      "drizzle-orm"
    );

    // Array para armazenar condições WHERE
    const conditions: any[] = [];

    // Filtro de busca por nome do cliente, CPF, telefone, email ou número da nota
    if (search?.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${clients.name})`, searchTerm),
          like(sql`LOWER(${clients.cpf})`, searchTerm),
          like(sql`LOWER(${clients.phone})`, searchTerm),
          like(sql`LOWER(${clients.email})`, searchTerm),
          like(sql`LOWER(${cashbackTransactions.invoiceNumber})`, searchTerm)
        )
      );
    }

    // Filtro por status
    if (status && status !== "all") {
      conditions.push(
        eq(
          cashbackTransactions.status,
          status as "pending" | "approved" | "paid" | "cancelled"
        )
      );
    }

    // Filtro por usuário responsável pelo cliente
    if (userId && userId !== "all") {
      conditions.push(eq(clients.responsavelId, userId));
    }

    // Filtro por data de venda
    if (startDate) {
      conditions.push(gte(cashbackTransactions.saleDate, new Date(startDate)));
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      conditions.push(lte(cashbackTransactions.saleDate, endDateTime));
    }

    // Filtro por valor de cashback
    if (minAmount) {
      conditions.push(gte(cashbackTransactions.cashbackAmount, minAmount));
    }
    if (maxAmount) {
      conditions.push(lte(cashbackTransactions.cashbackAmount, maxAmount));
    }

    // Configurar ordenação
    const orderByColumn = (() => {
      switch (sortBy) {
        case "clientName":
          return clients.name;
        case "cashbackAmount":
          return cashbackTransactions.cashbackAmount;
        case "purchaseAmount":
          return cashbackTransactions.purchaseAmount;
        case "cashbackRate":
          return cashbackTransactions.cashbackRate;
        case "saleDate":
          return cashbackTransactions.saleDate;
        case "status":
          return cashbackTransactions.status;
        case "createdAt":
        default:
          return cashbackTransactions.createdAt;
      }
    })();

    const orderDirection = sortOrder === "asc" ? asc : desc;

    // Aplicar paginação
    const limitNum = Math.min(limit, 100);

    // Buscar transações com paginação
    const transactionsQuery = db
      .select({
        id: cashbackTransactions.id,
        purchaseAmount: cashbackTransactions.purchaseAmount,
        cashbackAmount: cashbackTransactions.cashbackAmount,
        cashbackRate: cashbackTransactions.cashbackRate,
        status: cashbackTransactions.status,
        saleDate: cashbackTransactions.saleDate,
        expiresAt: cashbackTransactions.expiresAt,
        invoiceNumber: cashbackTransactions.invoiceNumber,
        notes: cashbackTransactions.notes,
        processedAt: cashbackTransactions.processedAt,
        createdAt: cashbackTransactions.createdAt,
        updatedAt: cashbackTransactions.updatedAt,
        // Cliente
        clientName: clients.name,
        clientPhone: clients.phone,
        clientCpf: clients.cpf,
        clientEmail: clients.email,
        // Usuário responsável pelo cliente
        responsibleUserId: clients.responsavelId,
        responsibleUserName: sql<string>`responsible_user.name`,
        responsibleUserEmail: sql<string>`responsible_user.email`,
        // Usuário que processou
        processedById: cashbackTransactions.processedBy,
        processedByName: sql<string>`processed_by_user.name`,
        processedByEmail: sql<string>`processed_by_user.email`,
      })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .leftJoin(
        sql`${users} as responsible_user`,
        eq(clients.responsavelId, sql`responsible_user.id`)
      )
      .leftJoin(
        sql`${users} as processed_by_user`,
        eq(cashbackTransactions.processedBy, sql`processed_by_user.id`)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection(orderByColumn))
      .limit(limitNum)
      .offset(offset);

    const transactions = await transactionsQuery;

    // Contar total de transações para paginação
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [{ count: totalItems }] = await countQuery;

    // Buscar estatísticas das transações filtradas
    const statsQuery = db
      .select({
        totalTransactions: sql<number>`count(*)`,
        totalPurchaseAmount: sql<string>`COALESCE(sum(${cashbackTransactions.purchaseAmount}), 0)`,
        totalCashbackAmount: sql<string>`COALESCE(sum(${cashbackTransactions.cashbackAmount}), 0)`,
        avgCashbackRate: sql<string>`COALESCE(avg(${cashbackTransactions.cashbackRate}), 0)`,
        pendingCount: sql<number>`count(case when ${cashbackTransactions.status} = 'pending' then 1 end)`,
        approvedCount: sql<number>`count(case when ${cashbackTransactions.status} = 'approved' then 1 end)`,
        paidCount: sql<number>`count(case when ${cashbackTransactions.status} = 'paid' then 1 end)`,
        cancelledCount: sql<number>`count(case when ${cashbackTransactions.status} = 'cancelled' then 1 end)`,
      })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [stats] = await statsQuery;

    return { data: transactions, total: totalItems, statistics: stats };
  }

  /**
   * Busca lista de resgates de cashback com filtros avançados e estatísticas
   *
   * @param filters - Filtros para a busca:
   *  - search: busca por nome, CPF, telefone, email do cliente ou descrição
   *  - userId: filtra por usuário responsável pelo cliente
   *  - authorizedById: filtra por quem autorizou o resgate
   *  - startDate: data inicial de criação
   *  - endDate: data final de criação
   *  - minAmount: valor mínimo usado
   *  - maxAmount: valor máximo usado
   *  - sortBy: campo para ordenação (clientName, usedAmount, authorizedBy, description, createdAt)
   *  - sortOrder: direção da ordenação (asc, desc)
   *  - page: número da página
   *  - limit: itens por página (máximo 100)
   * @returns Lista de resgates, total de itens e estatísticas
   */
  async getCashbackUsageList(filters: {
    search?: string;
    userId?: string;
    authorizedById?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: string;
    maxAmount?: string;
    sortBy?:
      | "clientName"
      | "usedAmount"
      | "authorizedBy"
      | "description"
      | "createdAt";
    sortOrder?: "asc" | "desc";
    page: number;
    limit: number;
  }): Promise<{
    data: any[];
    total: number;
    statistics: {
      totalUsages: number;
      totalUsedAmount: string;
      avgUsageAmount: string;
      uniqueClients: number;
    };
    authorizerStats: Array<{
      authorizedById: string;
      authorizedByName: string;
      count: number;
      totalAmount: string;
    }>;
  }> {
    const {
      search,
      userId,
      authorizedById,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc",
      page,
      limit,
    } = filters;

    const offset = (page - 1) * limit;

    // Construir condições de filtro
    const conditions = [];

    // Filtro de busca por nome do cliente, CPF, telefone, email ou descrição
    if (search?.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${clients.name})`, searchTerm),
          like(sql`LOWER(${clients.cpf})`, searchTerm),
          like(sql`LOWER(${clients.phone})`, searchTerm),
          like(sql`LOWER(${clients.email})`, searchTerm),
          like(sql`LOWER(${cashbackUsage.description})`, searchTerm)
        )
      );
    }

    // Filtro por usuário responsável pelo cliente
    if (userId && userId !== "all") {
      conditions.push(eq(clients.responsavelId, userId));
    }

    // Filtro por quem autorizou o resgate
    if (authorizedById && authorizedById !== "all") {
      conditions.push(eq(cashbackUsage.authorizedBy, authorizedById));
    }

    // Filtro por data de criação
    if (startDate) {
      conditions.push(gte(cashbackUsage.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      conditions.push(lte(cashbackUsage.createdAt, endDateTime));
    }

    // Filtro por valor usado
    if (minAmount) {
      conditions.push(gte(cashbackUsage.usedAmount, minAmount));
    }
    if (maxAmount) {
      conditions.push(lte(cashbackUsage.usedAmount, maxAmount));
    }

    // Configurar ordenação
    const orderByColumn = (() => {
      switch (sortBy) {
        case "clientName":
          return clients.name;
        case "usedAmount":
          return cashbackUsage.usedAmount;
        case "authorizedBy":
          return sql`authorized_by_user.name`;
        case "description":
          return cashbackUsage.description;
        case "createdAt":
        default:
          return cashbackUsage.createdAt;
      }
    })();

    const orderDirection = sortOrder === "asc" ? asc : desc;

    // Buscar resgates com paginação
    const usagesQuery = db
      .select({
        id: cashbackUsage.id,
        usedAmount: cashbackUsage.usedAmount,
        description: cashbackUsage.description,
        createdAt: cashbackUsage.createdAt,
        // Cliente
        clientName: clients.name,
        clientPhone: clients.phone,
        clientCpf: clients.cpf,
        clientEmail: clients.email,
        // Usuário responsável pelo cliente
        responsibleUserId: clients.responsavelId,
        responsibleUserName: sql<string>`responsible_user.name`,
        responsibleUserEmail: sql<string>`responsible_user.email`,
        // Quem autorizou o resgate
        authorizedById: cashbackUsage.authorizedBy,
        authorizedByName: sql<string>`authorized_by_user.name`,
        authorizedByEmail: sql<string>`authorized_by_user.email`,
      })
      .from(cashbackUsage)
      .innerJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .leftJoin(
        sql`${users} as responsible_user`,
        eq(clients.responsavelId, sql`responsible_user.id`)
      )
      .innerJoin(
        sql`${users} as authorized_by_user`,
        eq(cashbackUsage.authorizedBy, sql`authorized_by_user.id`)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderDirection(orderByColumn))
      .limit(limit)
      .offset(offset);

    const data = await usagesQuery;

    // Contar total de resgates para paginação
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(cashbackUsage)
      .innerJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [{ count: total }] = await countQuery;

    // Buscar estatísticas dos resgates filtrados
    const statsQuery = db
      .select({
        totalUsages: sql<number>`count(*)`,
        totalUsedAmount: sql<string>`COALESCE(sum(${cashbackUsage.usedAmount}), 0)`,
        avgUsageAmount: sql<string>`COALESCE(avg(${cashbackUsage.usedAmount}), 0)`,
        uniqueClients: sql<number>`count(distinct ${cashbackUsage.clientId})`,
      })
      .from(cashbackUsage)
      .innerJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [statistics] = await statsQuery;

    // Buscar estatísticas por autorizador
    const authorizerStatsQuery = db
      .select({
        authorizedById: cashbackUsage.authorizedBy,
        authorizedByName: sql<string>`authorized_by_user.name`,
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`COALESCE(sum(${cashbackUsage.usedAmount}), 0)`,
      })
      .from(cashbackUsage)
      .innerJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .innerJoin(
        sql`${users} as authorized_by_user`,
        eq(cashbackUsage.authorizedBy, sql`authorized_by_user.id`)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(cashbackUsage.authorizedBy, sql`authorized_by_user.name`);

    const authorizerStats = await authorizerStatsQuery;

    return { data, total, statistics, authorizerStats };
  }

  /**
   * Busca relatórios completos de cashback com estatísticas de dashboard,
   * top clientes, configurações ativas, tendências mensais e performance de vendedores
   *
   * @param filters - Filtros para o relatório:
   *  - search: busca por nome, email ou telefone do cliente
   *  - startDate: data inicial para filtros de transações
   *  - endDate: data final para filtros de transações
   *  - sellerId: filtra por vendedor responsável
   *  - clientId: filtra por cliente específico
   * @returns Objeto com dashboardStats, topClients, activeSettings, monthlyTrends, monthlyUsageTrends, sellersPerformance
   */
  async getCashbackReports(filters: {
    search?: string;
    startDate?: string;
    endDate?: string;
    sellerId?: string;
    clientId?: string;
  }): Promise<{
    dashboardStats: any;
    topClients: any[];
    activeSettings: any[];
    monthlyTrends: any[];
    monthlyUsageTrends: any[];
    sellersPerformance: any[];
  }> {
    const { search, startDate, endDate, sellerId, clientId } = filters;

    // Construir condições de data
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(
        gte(cashbackTransactions.createdAt, new Date(startDate))
      );
    }
    if (endDate) {
      dateConditions.push(
        lte(cashbackTransactions.createdAt, new Date(endDate))
      );
    }

    // Construir condições de busca
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        or(
          like(clients.name, `%${search}%`),
          like(clients.email, `%${search}%`),
          like(clients.phone, `%${search}%`)
        )
      );
    }

    // Construir condições de vendedor
    const sellerConditions = [];
    if (sellerId) {
      sellerConditions.push(eq(clients.responsavelId, sellerId));
    }

    if (clientId) {
      sellerConditions.push(eq(clientCashbackBalance.clientId, clientId));
    }

    // Buscar estatísticas do dashboard
    const [dashboardStats] = await db
      .select({
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        totalPendingBalance: sql<number>`COALESCE(SUM(${clientCashbackBalance.currentBalance}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        totalUsageCount: count(cashbackUsage.id),
        totalClientsWithBalance: sql<number>`COUNT(DISTINCT CASE WHEN ${clientCashbackBalance.currentBalance} > 0 THEN ${clientCashbackBalance.clientId} END)`,
      })
      .from(cashbackTransactions)
      .fullJoin(
        cashbackUsage,
        eq(cashbackTransactions.clientId, cashbackUsage.clientId)
      )
      .fullJoin(
        clientCashbackBalance,
        eq(cashbackTransactions.clientId, clientCashbackBalance.clientId)
      )
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(and(...dateConditions, ...sellerConditions));

    // Buscar top 5 clientes por total ganho
    const topClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        totalEarned: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        currentBalance: clientCashbackBalance.currentBalance,
        responsibleUserId: users.id,
        responsibleUserName: users.name,
        responsibleUserEmail: users.email,
      })
      .from(clients)
      .leftJoin(
        cashbackTransactions,
        eq(clients.id, cashbackTransactions.clientId)
      )
      .leftJoin(cashbackUsage, eq(clients.id, cashbackUsage.clientId))
      .leftJoin(
        clientCashbackBalance,
        eq(clients.id, clientCashbackBalance.clientId)
      )
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(and(...searchConditions, ...dateConditions, ...sellerConditions))
      .groupBy(
        clients.id,
        clients.name,
        clients.email,
        clients.phone,
        clientCashbackBalance.currentBalance,
        users.id,
        users.name,
        users.email
      )
      .orderBy(
        desc(
          sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`
        )
      )
      .limit(5);

    // Buscar configurações ativas
    const activeSettings = await db
      .select({
        id: cashbackSettings.id,
        name: cashbackSettings.name,
        percentageRate: cashbackSettings.percentageRate,
        minimumPurchase: cashbackSettings.minimumPurchase,
        maximumCashback: cashbackSettings.maximumCashback,
        isActive: cashbackSettings.isActive,
        createdAt: cashbackSettings.createdAt,
        updatedAt: cashbackSettings.updatedAt,
      })
      .from(cashbackSettings)
      .where(eq(cashbackSettings.isActive, "true"))
      .orderBy(desc(cashbackSettings.createdAt));

    // Buscar tendências mensais dos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await db
      .select({
        month: sql<string>`TO_CHAR(${cashbackTransactions.createdAt}, 'YYYY-MM')`,
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
      })
      .from(cashbackTransactions)
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          gte(cashbackTransactions.createdAt, sixMonthsAgo),
          ...sellerConditions
        )
      )
      .groupBy(sql`TO_CHAR(${cashbackTransactions.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${cashbackTransactions.createdAt}, 'YYYY-MM')`));

    // Buscar tendências de uso mensais dos últimos 6 meses
    const monthlyUsageTrends = await db
      .select({
        month: sql<string>`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        totalUsageCount: count(cashbackUsage.id),
        avgUsageValue: sql<number>`COALESCE(AVG(${cashbackUsage.usedAmount}), 0)`,
      })
      .from(cashbackUsage)
      .leftJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(
        and(gte(cashbackUsage.createdAt, sixMonthsAgo), ...sellerConditions)
      )
      .groupBy(sql`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`));

    // Buscar performance dos vendedores
    const sellersPerformance = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        totalClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        totalClientsWithBalance: sql<number>`COUNT(DISTINCT CASE WHEN ${clientCashbackBalance.currentBalance} > 0 THEN ${clientCashbackBalance.clientId} END)`,
      })
      .from(users)
      .leftJoin(clients, eq(users.id, clients.responsavelId))
      .leftJoin(
        clientCashbackBalance,
        eq(clients.id, clientCashbackBalance.clientId)
      )
      .leftJoin(
        cashbackTransactions,
        eq(clientCashbackBalance.clientId, cashbackTransactions.clientId)
      )
      .where(
        and(...dateConditions, sellerId ? eq(users.id, sellerId) : sql`1=1`)
      )
      .groupBy(users.id, users.name, users.email)
      .having(sql`COUNT(${cashbackTransactions.id}) > 0`)
      .orderBy(
        desc(
          sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`
        )
      )
      .limit(10);

    return {
      dashboardStats,
      topClients,
      activeSettings,
      monthlyTrends,
      monthlyUsageTrends,
      sellersPerformance,
    };
  }
}

export const cashbackStatisticsRepository = new CashbackStatisticsRepository();
