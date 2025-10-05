import { Request, Response } from "express";
import { sql, eq, and, gte, lte, ilike, or, asc, desc } from "drizzle-orm";
import { db } from "../../db";
import { clientCashbackBalance, clients, users } from "../../../shared/schema";

interface CashbackBalancesQuery {
  search?: string;
  userId?: string; // Filtro por vendedor responsável
  minBalance?: string;
  maxBalance?: string;
  sortBy?:
    | "clientName"
    | "currentBalance"
    | "totalEarned"
    | "totalUsed"
    | "sellerName"
    | "lastUpdated";
  sortOrder?: "asc" | "desc";
  page?: string;
  limit?: string;
}

interface CashbackBalanceItem {
  id: string;
  clientId: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  clientEmail: string;
  currentBalance: string;
  totalEarned: string;
  totalUsed: string;
  lastUpdated: string;
  sellerId: string | null;
  sellerName: string | null;
  sellerEmail: string | null;
}

interface CashbackBalancesResponse {
  success: boolean;
  data: {
    balances: CashbackBalanceItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    statistics: {
      totalClients: number;
      totalCurrentBalance: string;
      totalEarnedEver: string;
      totalUsedEver: string;
      averageBalance: string;
    };
  };
}

export async function getCashbackBalancesController(
  req: Request,
  res: Response
) {
  try {
    console.log("Cashback balances controller called with query:", req.query);

    const {
      search = "",
      userId,
      minBalance,
      maxBalance,
      sortBy = "currentBalance",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query as CashbackBalancesQuery;

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
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Máximo de 100 registros
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const offsetNum = (pageNum - 1) * limitNum;

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
      .offset(offsetNum);

    // Executar query principal
    const result = await query;
    console.log("Raw query result:", result.length, "records found");

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

    // Formatar resposta no formato esperado pelo frontend
    const formattedBalances: CashbackBalanceItem[] = result.map((item) => ({
      id: item.id,
      clientId: item.clientId,
      clientName: item.clientName,
      clientCpf: item.clientCpf || "",
      clientPhone: item.clientPhone || "",
      clientEmail: item.clientEmail || "",
      currentBalance: item.currentBalance,
      totalEarned: item.totalEarned,
      totalUsed: item.totalUsed,
      lastUpdated: item.lastUpdated.toISOString(),
      sellerId: item.sellerId,
      sellerName: item.sellerName || "Sem responsável",
      sellerEmail: item.sellerEmail || "",
    }));

    // Calcular paginação
    const totalPages = Math.ceil(count / limitNum);

    const response: CashbackBalancesResponse = {
      success: true,
      data: {
        balances: formattedBalances,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
        },
        statistics: {
          totalClients: parseInt(stats.totalClients.toString()),
          totalCurrentBalance: stats.totalCurrentBalance.toString(),
          totalEarnedEver: stats.totalEarnedEver.toString(),
          totalUsedEver: stats.totalUsedEver.toString(),
          averageBalance: stats.averageBalance.toString(),
        },
      },
    };

    console.log(
      `Returning ${formattedBalances.length} balances out of ${count} total`
    );
    res.json(response);
  } catch (error) {
    console.error("Erro ao buscar saldos de cashback:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar saldos de cashback",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
