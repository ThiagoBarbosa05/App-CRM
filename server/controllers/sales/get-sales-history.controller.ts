import { Request, Response } from "express";
import { sql, eq, and, gte, lte, ilike, or, asc, desc } from "drizzle-orm";
import { db } from "../../db";
import { sales, clients, users } from "../../../shared/schema";

interface SalesQuery {
  search?: string;
  clientId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  sortBy?:
    | "date"
    | "grossValue"
    | "netValue"
    | "cashbackGenerated"
    | "clientName"
    | "sellerName"
    | "createdAt";
  sortOrder?: "asc" | "desc";
  limit?: string;
  offset?: string;
}

interface SalesHistoryResponse {
  success: boolean;
  data: {
    sales: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
    statistics: {
      totalSales: number;
      totalGrossValue: string;
      totalNetValue: string;
      totalCashbackUsed: string;
      totalCashbackGenerated: string;
    };
  };
}

export async function getSalesHistoryController(req: Request, res: Response) {
  try {
    console.log("Sales history controller called with query:", req.query);

    const {
      search = "",
      clientId,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc",
      limit = "50",
      offset = "0",
    } = req.query as SalesQuery;

    // Array para armazenar condições WHERE
    const whereConditions: any[] = [];

    // Filtro por busca (nome do cliente, CPF, telefone, vendedor ou nota fiscal)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.cpf, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(users.name, searchTerm),
          ilike(sales.invoiceNumber, searchTerm)
        )
      );
    }

    // Filtro por cliente específico
    if (clientId) {
      whereConditions.push(eq(sales.clientId, clientId));
    }

    // Filtro por usuário/vendedor
    if (userId) {
      whereConditions.push(eq(sales.userId, userId));
    }

    // Filtro por data de início
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      whereConditions.push(gte(sales.createdAt, start));
    }

    // Filtro por data de fim
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereConditions.push(lte(sales.createdAt, end));
    }

    // Filtro por valor mínimo
    if (minAmount) {
      whereConditions.push(gte(sales.grossValue, minAmount));
    }

    // Filtro por valor máximo
    if (maxAmount) {
      whereConditions.push(lte(sales.grossValue, maxAmount));
    }

    // Determinar ordenação
    const orderColumn = (() => {
      switch (sortBy) {
        case "date":
          return sales.date;
        case "grossValue":
          return sales.grossValue;
        case "netValue":
          return sales.netValue;
        case "cashbackGenerated":
          return sales.cashbackGenerated;
        case "clientName":
          return clients.name;
        case "sellerName":
          return users.name;
        case "createdAt":
          return sales.createdAt;
        default:
          return sales.createdAt;
      }
    })();

    const orderDirection =
      sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn);

    // Aplicar paginação
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Máximo de 100 registros
    const offsetNum = parseInt(offset) || 0;

    // Query principal com todas as condições
    const query = db
      .select({
        // Dados da venda
        id: sales.id,
        date: sales.date,
        grossValue: sales.grossValue,
        cashbackUsed: sales.cashbackUsed,
        netValue: sales.netValue,
        cashbackGenerated: sales.cashbackGenerated,
        notes: sales.notes,
        invoiceNumber: sales.invoiceNumber,
        createdAt: sales.createdAt,

        // Dados do cliente
        clientId: clients.id,
        clientName: clients.name,
        clientPhone: clients.phone,
        clientCpf: clients.cpf,

        // Dados do usuário (vendedor)
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(users, eq(sales.userId, users.id))
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
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(users, eq(sales.userId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const [{ count }] = await countQuery;

    // Query para estatísticas resumidas (com os mesmos filtros)
    const statsQuery = db
      .select({
        totalSales: sql<number>`count(*)`,
        totalAmount: sql<number>`coalesce(sum(${sales.grossValue}), 0)`,
        totalCashbackUsed: sql<number>`coalesce(sum(${sales.cashbackUsed}), 0)`,
        totalCashbackGenerated: sql<number>`coalesce(sum(${sales.cashbackGenerated}), 0)`,
        averageValue: sql<number>`coalesce(avg(${sales.grossValue}), 0)`,
      })
      .from(sales)
      .innerJoin(clients, eq(sales.clientId, clients.id))
      .leftJoin(users, eq(sales.userId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const [stats] = await statsQuery;

    // Formatar resposta no formato esperado pelo frontend
    const formattedSales = result.map((item) => ({
      id: item.id,
      clientName: item.clientName,
      clientCpf: item.clientCpf,
      clientPhone: item.clientPhone,
      invoice: item.invoiceNumber || "",
      grossValue: item.grossValue,
      netValue: item.netValue,
      cashbackUsed: item.cashbackUsed,
      cashbackGenerated: item.cashbackGenerated,
      createdAt: item.createdAt,
      updatedAt: item.createdAt, // Usando createdAt como updatedAt por enquanto
      sellerName: item.userName || "N/A",
    }));

    // Calcular paginação
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offsetNum / limitNum) + 1;

    const response = {
      success: true,
      data: {
        sales: formattedSales,
        pagination: {
          currentPage,
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
        },
        statistics: {
          totalSales: parseInt(stats.totalSales.toString()),
          totalGrossValue: stats.totalAmount.toString(),
          totalNetValue: (
            parseFloat(stats.totalAmount.toString()) -
            parseFloat(stats.totalCashbackUsed.toString())
          ).toString(),
          totalCashbackUsed: stats.totalCashbackUsed.toString(),
          totalCashbackGenerated: stats.totalCashbackGenerated.toString(),
        },
      },
    };

    console.log(
      `Returning ${formattedSales.length} sales out of ${count} total`
    );
    res.json(response);
  } catch (error) {
    console.error("Erro ao buscar histórico de vendas:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar histórico de vendas",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
