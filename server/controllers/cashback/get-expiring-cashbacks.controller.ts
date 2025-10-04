import { Request, Response } from "express";
import { eq, and, gte, lte, ilike, or, asc, desc, sql } from "drizzle-orm";
import { db } from "../../db";
import { cashbackTransactions, clients, users } from "../../../shared/schema";

interface ExpiringCashbacksQuery {
  search?: string;
  sortBy?: "amount" | "expiresAt" | "clientName" | "sellerName";
  sortOrder?: "asc" | "desc";
  limit?: string;
  offset?: string;
}

export async function getExpiringCashbacks(req: Request, res: Response) {
  try {
    const {
      search = "",
      sortBy = "expiresAt",
      sortOrder = "asc",
      limit = "50",
      offset = "0",
    } = req.query as ExpiringCashbacksQuery;

    // Calcular datas para filtrar cashbacks que vencem nos próximos 7 dias
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    // Resetar horários para considerar dias completos
    today.setHours(0, 0, 0, 0);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    // Query base com joins para pegar dados do cliente e vendedor
    let query = db
      .select({
        // Dados da transação de cashback
        id: cashbackTransactions.id,
        cashbackAmount: cashbackTransactions.cashbackAmount,
        purchaseAmount: cashbackTransactions.purchaseAmount,
        cashbackRate: cashbackTransactions.cashbackRate,
        expiresAt: cashbackTransactions.expiresAt,
        status: cashbackTransactions.status,
        notes: cashbackTransactions.notes,
        invoiceNumber: cashbackTransactions.invoiceNumber,
        saleDate: cashbackTransactions.saleDate,
        createdAt: cashbackTransactions.createdAt,

        // Dados do cliente
        clientId: clients.id,
        clientName: clients.name,
        clientPhone: clients.phone,
        clientCpf: clients.cpf,
        clientEmail: clients.email,

        // Dados do vendedor (usuário responsável)
        sellerId: users.id,
        sellerName: users.name,
        sellerEmail: users.email,
      })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          // Apenas cashbacks aprovados
          eq(cashbackTransactions.status, "approved"),
          // Que vencem nos próximos 7 dias
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow)
        )
      );

    // Aplicar filtro de busca se fornecido
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;

      query = query.where(
        and(
          // Condições de data e status (mantém as anteriores)
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow),
          // Adiciona busca por nome do cliente ou vendedor
          or(
            ilike(clients.name, searchTerm),
            ilike(users.name, searchTerm),
            ilike(clients.phone, searchTerm),
            ilike(clients.cpf, searchTerm)
          )
        )
      );
    }

    // Aplicar ordenação
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
    query = query.orderBy(orderDirection);

    // Aplicar paginação
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Máximo de 100 registros
    const offsetNum = parseInt(offset) || 0;

    query = query.limit(limitNum).offset(offsetNum);

    // Executar query
    const result = await query;

    // Contar total de registros para paginação
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, today),
          lte(cashbackTransactions.expiresAt, sevenDaysFromNow),
          // Aplicar mesmo filtro de busca na contagem
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

    // Formatar resposta
    const formattedResult = result.map((item) => {
      const expiryDate = new Date(item.expiresAt);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: item.id,
        cashbackAmount: parseFloat(item.cashbackAmount),
        purchaseAmount: parseFloat(item.purchaseAmount),
        cashbackRate: parseFloat(item.cashbackRate),
        expiresAt: item.expiresAt,
        daysUntilExpiry,
        status: item.status,
        notes: item.notes,
        invoiceNumber: item.invoiceNumber,
        saleDate: item.saleDate,
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

    // Calcular estatísticas resumidas
    const totalAmount = formattedResult.reduce(
      (sum, item) => sum + item.cashbackAmount,
      0
    );

    const statistics = {
      totalRecords: count,
      totalAmount,
      averageAmount: count > 0 ? totalAmount / count : 0,
      daysRange: 7,
    };

    res.json({
      success: true,
      data: formattedResult,
      statistics,
      pagination: {
        total: count,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < count,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar cashbacks vencendo:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar cashbacks vencendo",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
