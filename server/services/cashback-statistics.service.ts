import {
  cashbackStatisticsRepository,
  type CashbackTransactionWithClient,
  type ClientCashbackBalanceWithClient,
} from "../repositories/cashback-statistics.repository";

/**
 * Interface para estatísticas de cashback
 */
export interface CashbackStatistics {
  totalCashback: number;
  activeClients: number;
  averageRate: number;
  totalClients: number;
  totalTransactions: number;
  totalSettings: number;
}

/**
 * Service responsável pela lógica de negócio de estatísticas de cashback
 */
class CashbackStatisticsService {
  /**
   * Busca todas as transações de cashback
   *
   * @param userId - ID do usuário (opcional)
   * @param userRole - Role do usuário (opcional)
   * @returns Lista de transações
   */
  async getCashbackTransactions(
    userId?: string,
    userRole?: string
  ): Promise<CashbackTransactionWithClient[]> {
    return await cashbackStatisticsRepository.getCashbackTransactions(
      userId,
      userRole
    );
  }

  /**
   * Busca todos os saldos de cashback
   *
   * @param userId - ID do usuário (opcional)
   * @param userRole - Role do usuário (opcional)
   * @returns Lista de saldos
   */
  async getAllCashbackBalances(
    userId?: string,
    userRole?: string
  ): Promise<ClientCashbackBalanceWithClient[]> {
    return await cashbackStatisticsRepository.getAllCashbackBalances(
      userId,
      userRole
    );
  }

  /**
   * Busca todas as configurações de cashback
   *
   * @returns Lista de configurações
   */
  async getCashbackSettings() {
    return await cashbackStatisticsRepository.getCashbackSettings();
  }

  /**
   * Calcula estatísticas gerais do sistema de cashback
   *
   * @returns Objeto com estatísticas calculadas
   *
   * @example
   * const stats = await service.calculateStatistics();
   * // {
   * //   totalCashback: 15000.50,
   * //   activeClients: 42,
   * //   averageRate: 12.5,
   * //   totalClients: 100,
   * //   totalTransactions: 250,
   * //   totalSettings: 5
   * // }
   *
   * @notes
   * - totalCashback: soma de todas transações aprovadas
   * - activeClients: clientes com saldo > 0
   * - averageRate: média das taxas de configurações ativas
   * - totalClients: total de clientes que já tiveram cashback
   * - totalTransactions: total de transações registradas
   * - totalSettings: total de configurações cadastradas
   */
  async calculateStatistics(): Promise<CashbackStatistics> {
    // Buscar transações
    const transactions = await this.getCashbackTransactions();

    // Calcular total de cashback (apenas transações aprovadas)
    const totalCashback = transactions.reduce((sum, transaction) => {
      if (transaction.status === "approved") {
        return sum + parseFloat(transaction.cashbackAmount || "0");
      }
      return sum;
    }, 0);

    // Buscar saldos
    const balances = await this.getAllCashbackBalances();

    // Contar clientes ativos (com saldo > 0)
    const activeClients = balances.filter(
      (balance) => parseFloat(balance.currentBalance || "0") > 0
    ).length;

    // Total de clientes com cashback
    const totalClients = balances.length;

    // Buscar configurações
    const settings = await this.getCashbackSettings();

    // Calcular taxa média das configurações ativas
    const activeSettings = settings.filter(
      (setting: any) => setting.isActive === "true"
    );
    const averageRate =
      activeSettings.length > 0
        ? activeSettings.reduce(
            (sum: number, setting: any) =>
              sum + parseFloat(setting.percentageRate || "0"),
            0
          ) / activeSettings.length
        : 0;

    // Total de transações
    const totalTransactions = transactions.length;

    // Total de configurações
    const totalSettings = settings.length;

    return {
      totalCashback,
      activeClients,
      averageRate,
      totalClients,
      totalTransactions,
      totalSettings,
    };
  }

  /**
   * Busca cashbacks que estão próximos de expirar (próximos 7 dias)
   *
   * @param search - Termo de busca opcional
   * @param sortBy - Campo para ordenação
   * @param sortOrder - Direção da ordenação
   * @param limit - Limite de registros
   * @param offset - Offset para paginação
   * @returns Objeto com dados, estatísticas e paginação
   *
   * @example
   * const result = await service.getExpiringCashbacks();
   * const filtered = await service.getExpiringCashbacks("João", "expiresAt", "asc", 20, 0);
   */
  async getExpiringCashbacks(
    search?: string,
    sortBy: "amount" | "expiresAt" | "clientName" | "sellerName" = "expiresAt",
    sortOrder: "asc" | "desc" = "asc",
    limit: number = 50,
    offset: number = 0
  ) {
    const { data, total, today } =
      await cashbackStatisticsRepository.getExpiringCashbacks(
        search,
        sortBy,
        sortOrder,
        limit,
        offset
      );

    // Formatar resposta
    const formattedResult = data.map((item) => {
      const expiryDate = new Date(item.expiresAt!);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: item.id,
        cashbackAmount: parseFloat(item.cashbackAmount!),
        purchaseAmount: parseFloat(item.purchaseAmount!),
        cashbackRate: parseFloat(item.cashbackRate!),
        expiresAt: item.expiresAt,
        daysUntilExpiry,
        status: item.status,
        notes: item.notes,
        createdAt: item.createdAt,
        client: {
          id: item.clientId,
          name: item.clientName,
          phone: item.clientPhone,
          cpf: item.clientCpf,
          email: item.clientEmail,
        },
        seller: item.sellerId
          ? {
              id: item.sellerId,
              name: item.sellerName,
              email: item.sellerEmail,
            }
          : null,
      };
    });

    // Calcular estatísticas
    const totalAmount = formattedResult.reduce(
      (sum, item) => sum + item.cashbackAmount,
      0
    );

    const statistics = {
      totalRecords: total,
      totalAmount,
      averageAmount: total > 0 ? totalAmount / total : 0,
      daysRange: 7,
    };

    return {
      data: formattedResult,
      statistics,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Busca saldos de cashback com filtros avançados
   *
   * @param search - Termo de busca
   * @param userId - ID do vendedor responsável
   * @param minBalance - Saldo mínimo
   * @param maxBalance - Saldo máximo
   * @param sortBy - Campo para ordenação
   * @param sortOrder - Direção da ordenação
   * @param page - Página atual (1-indexed)
   * @param limit - Limite de registros por página
   * @returns Objeto com saldos, paginação e estatísticas
   *
   * @example
   * const result = await service.getCashbackBalances();
   * const filtered = await service.getCashbackBalances("João", "user-123", "100", "1000", "currentBalance", "desc", 1, 20);
   *
   * @notes
   * - Retorna dados formatados com informações do cliente e vendedor
   * - Inclui estatísticas agregadas (total de clientes, saldos)
   * - Paginação calculada automaticamente
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
    page: number = 1,
    limit: number = 20
  ) {
    // Calcular offset
    const offset = (page - 1) * limit;

    // Buscar dados do repository
    const { data, total, statistics } =
      await cashbackStatisticsRepository.getCashbackBalances(
        search,
        userId,
        minBalance,
        maxBalance,
        sortBy,
        sortOrder,
        limit,
        offset
      );

    // Formatar saldos
    const formattedBalances = data.map((item) => ({
      id: item.id,
      clientId: item.clientId,
      clientName: item.clientName,
      clientCpf: item.clientCpf || "",
      clientPhone: item.clientPhone || "",
      clientEmail: item.clientEmail || "",
      currentBalance: item.currentBalance,
      totalEarned: item.totalEarned,
      totalUsed: item.totalUsed,
      lastUpdated: item.lastUpdated ? item.lastUpdated.toISOString() : "",
      sellerId: item.sellerId,
      sellerName: item.sellerName || "Sem responsável",
      sellerEmail: item.sellerEmail || "",
    }));

    // Calcular paginação
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        balances: formattedBalances,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
        },
        statistics: {
          totalClients: parseInt(statistics.totalClients.toString()),
          totalCurrentBalance: statistics.totalCurrentBalance.toString(),
          totalEarnedEver: statistics.totalEarnedEver.toString(),
          totalUsedEver: statistics.totalUsedEver.toString(),
          averageBalance: statistics.averageBalance.toString(),
        },
      },
    };
  }

  /**
   * Busca transações de cashback com filtros avançados
   *
   * @param search - Termo de busca
   * @param status - Status da transação
   * @param userId - ID do vendedor responsável
   * @param startDate - Data inicial de venda
   * @param endDate - Data final de venda
   * @param minAmount - Valor mínimo de cashback
   * @param maxAmount - Valor máximo de cashback
   * @param sortBy - Campo para ordenação
   * @param sortOrder - Direção da ordenação
   * @param page - Página atual (1-indexed)
   * @param limit - Limite de registros por página
   * @returns Objeto com transações, paginação e estatísticas
   *
   * @example
   * const result = await service.getCashbackTransactionsList();
   * const filtered = await service.getCashbackTransactionsList("João", "approved", "user-123", "2023-01-01", "2023-12-31", "10", "100", "createdAt", "desc", 1, 20);
   *
   * @notes
   * - Retorna dados formatados com informações do cliente, responsável e processador
   * - Inclui estatísticas agregadas (totais, médias, contagens por status)
   * - Paginação calculada automaticamente
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
    page: number = 1,
    limit: number = 20
  ) {
    // Calcular offset
    const offset = (page - 1) * limit;

    // Buscar dados do repository
    const { data, total, statistics } =
      await cashbackStatisticsRepository.getCashbackTransactionsList(
        search,
        status,
        userId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        sortBy,
        sortOrder,
        limit,
        offset
      );

    // Formatar transações
    const formattedTransactions = data.map((transaction) => ({
      id: transaction.id,
      clientName: transaction.clientName,
      clientPhone: transaction.clientPhone || "",
      clientCpf: transaction.clientCpf || "",
      clientEmail: transaction.clientEmail || "",
      purchaseAmount: transaction.purchaseAmount,
      cashbackAmount: transaction.cashbackAmount,
      cashbackRate: transaction.cashbackRate,
      status: transaction.status,
      saleDate: transaction.saleDate?.toISOString() || null,
      expiresAt: transaction.expiresAt.toISOString(),
      invoiceNumber: transaction.invoiceNumber,
      notes: transaction.notes,
      processedBy: transaction.processedById
        ? {
            id: transaction.processedById,
            name: transaction.processedByName || "",
            email: transaction.processedByEmail || "",
          }
        : null,
      processedAt: transaction.processedAt?.toISOString() || null,
      responsibleUser: transaction.responsibleUserId
        ? {
            id: transaction.responsibleUserId,
            name: transaction.responsibleUserName || "",
            email: transaction.responsibleUserEmail || "",
          }
        : null,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    }));

    // Calcular paginação
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
        statistics: {
          totalTransactions: statistics?.totalTransactions || 0,
          totalPurchaseAmount: statistics?.totalPurchaseAmount || "0.00",
          totalCashbackAmount: statistics?.totalCashbackAmount || "0.00",
          avgCashbackRate: statistics?.avgCashbackRate || "0.00",
          statusCounts: {
            pending: statistics?.pendingCount || 0,
            approved: statistics?.approvedCount || 0,
            paid: statistics?.paidCount || 0,
            cancelled: statistics?.cancelledCount || 0,
          },
        },
      },
    };
  }

  /**
   * Busca lista de resgates de cashback com filtros, formatação e estatísticas
   *
   * @param filters - Filtros para a busca de resgates
   * @returns Lista formatada de resgates com paginação e estatísticas
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
  }) {
    const { data, total, statistics, authorizerStats } =
      await cashbackStatisticsRepository.getCashbackUsageList(filters);

    // Formatar resposta dos resgates
    const formattedUsages = data.map((usage) => ({
      id: usage.id,
      clientName: usage.clientName,
      clientPhone: usage.clientPhone || "",
      clientCpf: usage.clientCpf || "",
      clientEmail: usage.clientEmail || "",
      usedAmount: usage.usedAmount,
      description: usage.description,
      authorizedBy: {
        id: usage.authorizedById,
        name: usage.authorizedByName || "",
        email: usage.authorizedByEmail || "",
      },
      responsibleUser: usage.responsibleUserId
        ? {
            id: usage.responsibleUserId,
            name: usage.responsibleUserName || "",
            email: usage.responsibleUserEmail || "",
          }
        : null,
      createdAt: usage.createdAt.toISOString(),
    }));

    // Calcular paginação
    const totalPages = Math.ceil(total / filters.limit);
    const pagination = {
      page: filters.page,
      limit: filters.limit,
      totalItems: total,
      totalPages,
      hasNext: filters.page < totalPages,
      hasPrevious: filters.page > 1,
    };

    // Formatar estatísticas por autorizador
    const usagesByAuthorizer: {
      [key: string]: {
        name: string;
        count: number;
        totalAmount: string;
      };
    } = {};
    authorizerStats.forEach((stat) => {
      usagesByAuthorizer[stat.authorizedById] = {
        name: stat.authorizedByName || "",
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    });

    // Formatar estatísticas
    const formattedStatistics = {
      totalUsages: statistics?.totalUsages || 0,
      totalUsedAmount: statistics?.totalUsedAmount || "0.00",
      avgUsageAmount: statistics?.avgUsageAmount || "0.00",
      uniqueClients: statistics?.uniqueClients || 0,
      usagesByAuthorizer,
    };

    return {
      success: true,
      data: {
        usages: formattedUsages,
        pagination,
        statistics: formattedStatistics,
      },
    };
  }

  /**
   * Busca relatórios completos de cashback com estatísticas, top clientes,
   * configurações ativas, tendências mensais e performance de vendedores
   *
   * @param filters - Filtros para o relatório
   * @returns Relatórios formatados com todas as estatísticas
   */
  async getCashbackReports(filters: {
    search?: string;
    startDate?: string;
    endDate?: string;
    sellerId?: string;
    clientId?: string;
  }) {
    const {
      dashboardStats,
      topClients,
      activeSettings,
      monthlyTrends,
      monthlyUsageTrends,
      sellersPerformance,
    } = await cashbackStatisticsRepository.getCashbackReports(filters);

    // Formatar top clientes com objeto de usuário responsável
    const formattedTopClients = topClients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      totalEarned: client.totalEarned,
      totalUsed: client.totalUsed,
      currentBalance: client.currentBalance || "0.00",
      responsibleUser: client.responsibleUserId
        ? {
            id: client.responsibleUserId,
            name: client.responsibleUserName || "",
            email: client.responsibleUserEmail || "",
          }
        : null,
    }));

    // Formatar configurações ativas com datas em ISO
    const formattedActiveSettings = activeSettings.map((setting) => ({
      id: setting.id,
      name: setting.name,
      percentageRate: setting.percentageRate,
      minimumPurchase: setting.minimumPurchase,
      maximumCashback: setting.maximumCashback,
      isActive: setting.isActive,
      createdAt: setting.createdAt?.toISOString() || null,
      updatedAt: setting.updatedAt?.toISOString() || null,
    }));

    return {
      success: true,
      data: {
        dashboardStats,
        topClients: formattedTopClients,
        activeSettings: formattedActiveSettings,
        monthlyTrends,
        monthlyUsageTrends,
        sellersPerformance,
      },
    };
  }
}

export const cashbackStatisticsService = new CashbackStatisticsService();
