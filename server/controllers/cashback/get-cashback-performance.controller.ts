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
  avg,
  isNull,
  ne
} from "drizzle-orm";

interface PerformanceFilters {
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  periodType?: "daily" | "weekly" | "monthly";
  compareWithPrevious?: boolean;
}

export async function getCashbackPerformance(req: Request, res: Response) {
  try {
    const {
      startDate,
      endDate,
      sellerId,
      periodType = "monthly",
      compareWithPrevious = false
    } = req.query as unknown as PerformanceFilters;

    // Set default date range if not provided (last 30 days)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const actualStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const actualEndDate = endDate ? new Date(endDate) : defaultEndDate;

    // Build conditions
    const dateConditions = [
      gte(cashbackTransactions.createdAt, actualStartDate),
      lte(cashbackTransactions.createdAt, actualEndDate)
    ];

    const sellerConditions = [];
    if (sellerId) {
      sellerConditions.push(eq(clients.responsavelId, parseInt(sellerId)));
    }

    // Get conversion metrics
    const conversionMetrics = await db
      .select({
        totalTransactions: count(cashbackTransactions.id),
        totalUsages: count(cashbackUsage.id),
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        totalPurchaseValue: sql<number>`COALESCE(SUM(${cashbackTransactions.purchaseAmount}), 0)`,
        avgCashbackPercentage: sql<number>`COALESCE(AVG(${cashbackTransactions.cashbackAmount} * 100.0 / NULLIF(${cashbackTransactions.purchaseAmount}, 0)), 0)`,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        avgUsageValue: sql<number>`COALESCE(AVG(${cashbackUsage.usedAmount}), 0)`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`,
        uniqueUsageClients: sql<number>`COUNT(DISTINCT ${cashbackUsage.clientId})`
      })
      .from(cashbackTransactions)
      .leftJoin(cashbackUsage, eq(cashbackTransactions.clientId, cashbackUsage.clientId))
      .leftJoin(clientCashbackBalance, eq(cashbackTransactions.clientId, clientCashbackBalance.clientId))
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          ...dateConditions,
          ...sellerConditions
        )
      );

    // Get period-based trends
    let groupByPeriod: any;
    let dateFormat: string;

    switch (periodType) {
      case "daily":
        groupByPeriod = sql`DATE(${cashbackTransactions.createdAt})`;
        dateFormat = "YYYY-MM-DD";
        break;
      case "weekly":
        groupByPeriod = sql`DATE_TRUNC('week', ${cashbackTransactions.createdAt})`;
        dateFormat = "YYYY-\"W\"WW";
        break;
      case "monthly":
      default:
        groupByPeriod = sql`DATE_TRUNC('month', ${cashbackTransactions.createdAt})`;
        dateFormat = "YYYY-MM";
        break;
    }

    const periodTrends = await db
      .select({
        period: sql<string>`TO_CHAR(${groupByPeriod}, '${dateFormat}')`,
        totalTransactions: count(cashbackTransactions.id),
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalPurchaseValue: sql<number>`COALESCE(SUM(${cashbackTransactions.purchaseAmount}), 0)`,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`
      })
      .from(cashbackTransactions)
      .leftJoin(clientCashbackBalance, eq(cashbackTransactions.clientId, clientCashbackBalance.clientId))
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          ...dateConditions,
          ...sellerConditions
        )
      )
      .groupBy(groupByPeriod)
      .orderBy(asc(groupByPeriod));

    // Get usage period trends
    const usagePeriodTrends = await db
      .select({
        period: sql<string>`TO_CHAR(DATE_TRUNC('${periodType}', ${cashbackUsage.createdAt}), '${dateFormat}')`,
        totalUsages: count(cashbackUsage.id),
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        avgUsageValue: sql<number>`COALESCE(AVG(${cashbackUsage.usedAmount}), 0)`,
        uniqueUsageClients: sql<number>`COUNT(DISTINCT ${cashbackUsage.clientId})`
      })
      .from(cashbackUsage)
      .leftJoin(clientCashbackBalance, eq(cashbackUsage.clientId, clientCashbackBalance.clientId))
      .leftJoin(clients, eq(cashbackUsage.clientId, clients.id))
      .where(
        and(
          gte(cashbackUsage.createdAt, actualStartDate),
          lte(cashbackUsage.createdAt, actualEndDate),
          ...sellerConditions
        )
      )
      .groupBy(sql`DATE_TRUNC('${periodType}', ${cashbackUsage.createdAt})`)
      .orderBy(asc(sql`DATE_TRUNC('${periodType}', ${cashbackUsage.createdAt})`));

    // Get client engagement metrics
    const clientEngagement = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        totalTransactions: count(cashbackTransactions.id),
        totalEarned: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
        currentBalance: clientCashbackBalance.currentBalance,
        usageRate: sql<number>`
          CASE 
            WHEN COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0) > 0 
            THEN (COALESCE(SUM(${cashbackUsage.usedAmount}), 0) * 100.0 / COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0))
            ELSE 0 
          END
        `,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        lastTransactionDate: sql<string>`MAX(${cashbackTransactions.createdAt})`,
        lastUsageDate: sql<string>`MAX(${cashbackUsage.createdAt})`,
        responsibleUser: {
          id: users.id,
          name: users.name
        }
      })
      .from(clients)
      .leftJoin(cashbackTransactions, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(cashbackUsage, eq(clients.id, cashbackUsage.clientId))
      .leftJoin(clientCashbackBalance, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          ...dateConditions,
          ...sellerConditions
        )
      )
      .groupBy(
        clients.id,
        clients.name,
        clientCashbackBalance.currentBalance,
        users.id,
        users.name
      )
      .having(sql`COUNT(${cashbackTransactions.id}) > 0`)
      .orderBy(desc(sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`))
      .limit(20);

    // Get cashback settings effectiveness
    const settingsEffectiveness = await db
      .select({
        settingId: cashbackTransactions.settingId,
        settingName: cashbackSettings.name,
        percentageRate: cashbackSettings.percentageRate,
        minimumPurchase: cashbackSettings.minimumPurchase,
        maximumCashback: cashbackSettings.maximumCashback,
        totalTransactions: count(cashbackTransactions.id),
        totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
        totalPurchaseValue: sql<number>`COALESCE(SUM(${cashbackTransactions.purchaseAmount}), 0)`,
        avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
        uniqueClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`
      })
      .from(cashbackTransactions)
      .leftJoin(cashbackSettings, eq(cashbackTransactions.settingId, cashbackSettings.id))
      .leftJoin(clientCashbackBalance, eq(cashbackTransactions.clientId, clientCashbackBalance.clientId))
      .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          ...dateConditions,
          ...sellerConditions,
          ne(cashbackTransactions.settingId, sql`null`)
        )
      )
      .groupBy(
        cashbackTransactions.settingId,
        cashbackSettings.name,
        cashbackSettings.percentageRate,
        cashbackSettings.minimumPurchase,
        cashbackSettings.maximumCashback
      )
      .orderBy(desc(count(cashbackTransactions.id)));

    let previousPeriodMetrics = null;

    if (compareWithPrevious) {
      // Calculate previous period dates
      const periodDiff = actualEndDate.getTime() - actualStartDate.getTime();
      const previousEndDate = new Date(actualStartDate.getTime() - 1);
      const previousStartDate = new Date(actualStartDate.getTime() - periodDiff);

      const previousDateConditions = [
        gte(cashbackTransactions.createdAt, previousStartDate),
        lte(cashbackTransactions.createdAt, previousEndDate)
      ];

      [previousPeriodMetrics] = await db
        .select({
          totalTransactions: count(cashbackTransactions.id),
          totalDistributed: sql<number>`COALESCE(SUM(${cashbackTransactions.cashbackAmount}), 0)`,
          totalUsed: sql<number>`COALESCE(SUM(${cashbackUsage.usedAmount}), 0)`,
          totalPurchaseValue: sql<number>`COALESCE(SUM(${cashbackTransactions.purchaseAmount}), 0)`,
          avgTransactionValue: sql<number>`COALESCE(AVG(${cashbackTransactions.purchaseAmount}), 0)`,
          uniqueClients: sql<number>`COUNT(DISTINCT ${cashbackTransactions.clientId})`
        })
        .from(cashbackTransactions)
        .leftJoin(cashbackUsage, eq(cashbackTransactions.clientId, cashbackUsage.clientId))
        .leftJoin(clientCashbackBalance, eq(cashbackTransactions.clientId, clientCashbackBalance.clientId))
        .leftJoin(clients, eq(cashbackTransactions.clientId, clients.id))
        .where(
          and(
            ...previousDateConditions,
            ...sellerConditions
          )
        );
    }

    // Calculate conversion rate and other KPIs
    const [currentMetrics] = conversionMetrics;
    const conversionRate = currentMetrics.totalTransactions > 0 
      ? (currentMetrics.totalUsages / currentMetrics.totalTransactions) * 100 
      : 0;

    const usageRate = currentMetrics.totalDistributed > 0 
      ? (currentMetrics.totalUsed / currentMetrics.totalDistributed) * 100 
      : 0;

    const clientRetention = currentMetrics.uniqueClients > 0 
      ? (currentMetrics.uniqueUsageClients / currentMetrics.uniqueClients) * 100 
      : 0;

    const response = {
      success: true,
      data: {
        metrics: {
          ...currentMetrics,
          conversionRate,
          usageRate,
          clientRetention
        },
        previousPeriodMetrics,
        periodTrends,
        usagePeriodTrends,
        clientEngagement,
        settingsEffectiveness
      },
      filters: {
        startDate: actualStartDate.toISOString(),
        endDate: actualEndDate.toISOString(),
        sellerId,
        periodType,
        compareWithPrevious
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching cashback performance:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}