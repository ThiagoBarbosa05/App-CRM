import { Request, Response } from "express";
import { db } from "../../db";
import { cashbackUsage, clients, users } from "../../../shared/schema";
import { and, like, sql, eq, desc, asc, or, gte, lte } from "drizzle-orm";

interface CashbackUsageFilters {
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
    | "createdAt"
    | "description";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface CashbackUsageResponse {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  clientEmail: string;
  usedAmount: string;
  description: string;
  authorizedBy: {
    id: string;
    name: string;
    email: string;
  };
  responsibleUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

interface CashbackUsageStatistics {
  totalUsages: number;
  totalUsedAmount: string;
  avgUsageAmount: string;
  uniqueClients: number;
  usagesByAuthorizer: {
    [key: string]: {
      name: string;
      count: number;
      totalAmount: string;
    };
  };
}

interface CashbackUsagePagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export async function getCashbackUsageController(req: Request, res: Response) {
  try {
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
      page = 1,
      limit = 20,
    } = req.query as CashbackUsageFilters;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

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
      .limit(limitNum)
      .offset(offset);

    const usages = await usagesQuery;

    // Contar total de resgates para paginação
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(cashbackUsage)
      .innerJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [{ count: totalItems }] = await countQuery;

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

    const [stats] = await statsQuery;

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

    // Formatar resposta dos resgates
    const formattedUsages: CashbackUsageResponse[] = usages.map((usage) => ({
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
    const totalPages = Math.ceil(totalItems / limitNum);
    const pagination: CashbackUsagePagination = {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    };

    // Formatar estatísticas por autorizador
    const usagesByAuthorizer: CashbackUsageStatistics["usagesByAuthorizer"] =
      {};
    authorizerStats.forEach((stat) => {
      usagesByAuthorizer[stat.authorizedById] = {
        name: stat.authorizedByName || "",
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    });

    // Formatar estatísticas
    const statistics: CashbackUsageStatistics = {
      totalUsages: stats?.totalUsages || 0,
      totalUsedAmount: stats?.totalUsedAmount || "0.00",
      avgUsageAmount: stats?.avgUsageAmount || "0.00",
      uniqueClients: stats?.uniqueClients || 0,
      usagesByAuthorizer,
    };

    return res.status(200).json({
      success: true,
      data: {
        usages: formattedUsages,
        pagination,
        statistics,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar resgates de cashback:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
