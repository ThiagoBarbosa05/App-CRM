import { Request, Response } from "express";
import { db } from "../../db";
import {
  cashbackTransactions,
  clients,
  users,
  cashbackSettings,
} from "../../../shared/schema";
import { and, like, sql, eq, desc, asc, or, gte, lte } from "drizzle-orm";

interface CashbackTransactionsFilters {
  search?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  sortBy?:
    | "clientName"
    | "cashbackAmount"
    | "purchaseAmount"
    | "cashbackRate"
    | "saleDate"
    | "status"
    | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface CashbackTransactionResponse {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  clientEmail: string;
  purchaseAmount: string;
  cashbackAmount: string;
  cashbackRate: string;
  status: string;
  saleDate: string | null;
  expiresAt: string;
  invoiceNumber: string | null;
  notes: string | null;
  processedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  processedAt: string | null;
  responsibleUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface CashbackTransactionsStatistics {
  totalTransactions: number;
  totalPurchaseAmount: string;
  totalCashbackAmount: string;
  avgCashbackRate: string;
  statusCounts: {
    pending: number;
    approved: number;
    paid: number;
    cancelled: number;
  };
}

interface CashbackTransactionsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export async function getCashbackTransactionsController(
  req: Request,
  res: Response
) {
  try {
    const {
      search,
      status,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query as CashbackTransactionsFilters;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Construir condições de filtro
    const conditions = [];

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

    // Formatar resposta das transações
    const formattedTransactions: CashbackTransactionResponse[] =
      transactions.map((transaction) => ({
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
    const totalPages = Math.ceil(totalItems / limitNum);
    const pagination: CashbackTransactionsPagination = {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    };

    // Formatar estatísticas
    const statistics: CashbackTransactionsStatistics = {
      totalTransactions: stats?.totalTransactions || 0,
      totalPurchaseAmount: stats?.totalPurchaseAmount || "0.00",
      totalCashbackAmount: stats?.totalCashbackAmount || "0.00",
      avgCashbackRate: stats?.avgCashbackRate || "0.00",
      statusCounts: {
        pending: stats?.pendingCount || 0,
        approved: stats?.approvedCount || 0,
        paid: stats?.paidCount || 0,
        cancelled: stats?.cancelledCount || 0,
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        transactions: formattedTransactions,
        pagination,
        statistics,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar transações de cashback:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
