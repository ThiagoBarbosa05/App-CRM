import { Request, Response } from "express";
import { db } from "../../db";
import {
  clientCashbackBalance,
  cashbackTransactions,
  cashbackUsage,
  clients,
  users,
  cashbackSettings
} from "../../../shared/schema";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  asc,
  like,
  or,
  sql,
  count,
  sum,
  isNull,
  ne
} from "drizzle-orm";

interface ReportsFilters {
  search?: string;
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  clientId?: string;
  hasActiveSettings?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getCashbackReports(req: Request, res: Response) {
  try {
    const {
      search,
      startDate,
      endDate,
      sellerId,
      clientId,
      hasActiveSettings,
      page = 1,
      limit = 10,
      sortBy = "totalEarned",
      sortOrder = "desc"
    } = req.query as unknown as ReportsFilters;

    const offset = (page - 1) * limit;

    // Build date conditions
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(gte(cashbackTransactions.createdAt, new Date(startDate)));
    }
    if (endDate) {
      dateConditions.push(lte(cashbackTransactions.createdAt, new Date(endDate)));
    }

    // Build search conditions
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

    // Build seller conditions
    const sellerConditions = [];
    if (sellerId) {
      sellerConditions.push(eq(clients.responsavelId, sellerId));
    }

    if (clientId) {
      sellerConditions.push(eq(clientCashbackBalance.clientId, clientId));
    }

    // Get dashboard statistics
    const [dashboardStats] = await db
      .select({
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        totalPendingBalance: sql<number>`COALESCE(SUM(${clientCashbackBalance.currentBalance}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        totalUsageCount: count(cashbackUsage.id),
        totalClientsWithBalance: sql<number>`COUNT(DISTINCT CASE WHEN ${clientCashbackBalance.currentBalance} > 0 THEN ${clientCashbackBalance.clientId} END)`
      })
      .from(cashbackTransactions)
      .fullJoin(cashbackUsage, eq(cashbackTransactions.clientId, cashbackUsage.clientId))
      .fullJoin(clientCashbackBalance, eq(cashbackTransactions.clientId, clientCashbackBalance.clientId))
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          ...dateConditions,
          ...sellerConditions
        )
      );

    // Get top 5 clients by total earned
    const topClientsQuery = db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        totalEarned: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        currentBalance: clientCashbackBalance.currentBalance,
        responsibleUser: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      })
      .from(clients)
      .leftJoin(cashbackTransactions, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(cashbackUsage, eq(clients.id, cashbackUsage.clientId))
      .leftJoin(clientCashbackBalance, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          ...searchConditions,
          ...dateConditions,
          ...sellerConditions
        )
      )
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
      .orderBy(desc(sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`))
      .limit(5);

    // Get active settings
    const activeSettingsQuery = db
      .select({
        id: cashbackSettings.id,
        name: cashbackSettings.name,
        percentageRate: cashbackSettings.percentageRate,
        minimumPurchase: cashbackSettings.minimumPurchase,
        maximumCashback: cashbackSettings.maximumCashback,
        isActive: cashbackSettings.isActive,
        createdAt: cashbackSettings.createdAt,
        updatedAt: cashbackSettings.updatedAt
      })
      .from(cashbackSettings)
      .where(eq(cashbackSettings.isActive, "true"))
      .orderBy(desc(cashbackSettings.createdAt));

    // Execute queries in parallel
    const [topClients, activeSettings] = await Promise.all([
      topClientsQuery,
      activeSettingsQuery
    ]);

    // Get monthly trends for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await db
      .select({
        month: sql<string>`TO_CHAR(${cashbackTransactions.createdAt}, 'YYYY-MM')`,
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`
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

    // Get usage trends for the last 6 months
    const monthlyUsageTrends = await db
      .select({
        month: sql<string>`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        totalUsageCount: count(cashbackUsage.id),
        avgUsageValue: sql<number>`COALESCE(AVG(${cashbackUsage.usedAmount}), 0)`
      })
      .from(cashbackUsage)
      .leftJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(
        and(
          gte(cashbackUsage.createdAt, sixMonthsAgo),
          ...sellerConditions
        )
      )
      .groupBy(sql`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${cashbackUsage.createdAt}, 'YYYY-MM')`));

    // Get top sellers performance
    const sellersPerformance = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalTransactions: count(cashbackTransactions.id),
        totalClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        totalClientsWithBalance: sql<number>`COUNT(DISTINCT CASE WHEN ${clientCashbackBalance.currentBalance} > 0 THEN ${clientCashbackBalance.clientId} END)`
      })
      .from(users)
      .leftJoin(clients, eq(users.id, clients.responsavelId))
      .leftJoin(clientCashbackBalance, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(cashbackTransactions, eq(clientCashbackBalance.clientId, cashbackTransactions.clientId))
      .where(
        and(
          ...dateConditions,
          sellerId ? eq(users.id, sellerId) : sql`1=1`
        )
      )
      .groupBy(users.id, users.name, users.email)
      .having(sql`COUNT(${cashbackTransactions.id}) > 0`)
      .orderBy(desc(sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`))
      .limit(10);

    const response = {
      success: true,
      data: {
        dashboardStats,
        topClients,
        activeSettings,
        monthlyTrends,
        monthlyUsageTrends,
        sellersPerformance
      },
      filters: {
        search,
        startDate,
        endDate,
        sellerId,
        clientId,
        hasActiveSettings,
        page,
        limit,
        sortBy,
        sortOrder
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching cashback reports:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}