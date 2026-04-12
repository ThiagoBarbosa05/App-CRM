import { Request, Response } from "express";
import { db } from "../../db";
import {
  companies,
  sectors,
  users,
  clients,
  tags,
  clientInteractions,
} from "@shared/schema";
import { sql, count, eq, and, isNull, gte, lte } from "drizzle-orm";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface GeneralReportsData {
  // General stats
  totalClients: number;
  totalCompanies: number;
  totalUsers: number;
  totalSectors: number;

  // Client stats by category
  clientsByCategory: Array<{
    category: string | null;
    count: number;
  }>;

  // Client stats by origin
  clientsByOrigin: Array<{
    origin: string | null;
    count: number;
  }>;

  // Client stats by responsible user
  clientsByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;

  // Company stats by sector
  companiesBySector: Array<{
    sectorId: string | null;
    sectorName: string;
    count: number;
  }>;

  // Recent activity stats (last 30 days)
  recentStats: {
    newClientsThisMonth: number;
    newCompaniesThisMonth: number;
    totalInteractionsThisMonth: number;
  };

  // Growth comparison (current vs previous month)
  growthStats: {
    clientGrowthPercent: number;
    companyGrowthPercent: number;
    interactionGrowthPercent: number;
  };
}

/**
 * Get comprehensive general reports data
 * Includes clients, companies, and activity statistics
 */
export const getGeneralReportsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Base conditions based on user role
    let clientCondition = sql`1=1`;
    let companyCondition = sql`1=1`;
    let interactionCondition = sql`1=1`;

    // If not admin, filter by responsible user
    if (userRole !== "admin" && userId) {
      clientCondition = eq(clients.responsavelId, userId);
      companyCondition = eq(companies.responsavelId, userId);
      interactionCondition = eq(clientInteractions.userId, userId);
    }

    // Date ranges for monthly comparisons
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));

    // Execute all queries in parallel for optimal performance
    const [
      // Basic counts
      clientCount,
      companyCount,
      userCount,
      sectorCount,

      // Client statistics
      clientsByCategoryStats,
      clientsByOriginStats,
      clientsByUserStats,

      // Company statistics
      companiesBySectorStats,

      // Current month activity
      newClientsThisMonth,
      newCompaniesThisMonth,
      interactionsThisMonth,

      // Previous month for comparison
      newClientsPreviousMonth,
      newCompaniesPreviousMonth,
      interactionsPreviousMonth,
    ] = await Promise.all([
      // Basic counts
      db.select({ count: count() }).from(clients).where(clientCondition),
      db.select({ count: count() }).from(companies).where(companyCondition),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(sectors),

      // Clients by category
      db
        .select({
          category: clients.categoria,
          count: count(),
        })
        .from(clients)
        .where(clientCondition)
        .groupBy(clients.categoria)
        .orderBy(sql`${count()} DESC`),

      // Clients by origin
      db
        .select({
          origin: clients.origem,
          count: count(),
        })
        .from(clients)
        .where(clientCondition)
        .groupBy(clients.origem)
        .orderBy(sql`${count()} DESC`),

      // Clients by responsible user
      db
        .select({
          userId: clients.responsavelId,
          userName: users.name,
          count: count(),
        })
        .from(clients)
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .where(clientCondition)
        .groupBy(clients.responsavelId, users.name)
        .orderBy(sql`${count()} DESC`),

      // Companies by sector
      db
        .select({
          sectorId: companies.sectorId,
          sectorName: sectors.name,
          count: count(),
        })
        .from(companies)
        .leftJoin(sectors, eq(companies.sectorId, sectors.id))
        .where(companyCondition)
        .groupBy(companies.sectorId, sectors.name)
        .orderBy(sql`${count()} DESC`),

      // Current month new clients
      db
        .select({ count: count() })
        .from(clients)
        .where(
          and(
            clientCondition,
            gte(clients.createdAt, currentMonthStart),
            lte(clients.createdAt, currentMonthEnd)
          )
        ),

      // Current month new companies
      db
        .select({ count: count() })
        .from(companies)
        .where(
          and(
            companyCondition,
            gte(companies.createdAt, currentMonthStart),
            lte(companies.createdAt, currentMonthEnd)
          )
        ),

      // Current month interactions
      db
        .select({ count: count() })
        .from(clientInteractions)
        .where(
          and(
            interactionCondition,
            gte(clientInteractions.createdAt, currentMonthStart),
            lte(clientInteractions.createdAt, currentMonthEnd)
          )
        ),

      // Previous month new clients
      db
        .select({ count: count() })
        .from(clients)
        .where(
          and(
            clientCondition,
            gte(clients.createdAt, previousMonthStart),
            lte(clients.createdAt, previousMonthEnd)
          )
        ),

      // Previous month new companies
      db
        .select({ count: count() })
        .from(companies)
        .where(
          and(
            companyCondition,
            gte(companies.createdAt, previousMonthStart),
            lte(companies.createdAt, previousMonthEnd)
          )
        ),

      // Previous month interactions
      db
        .select({ count: count() })
        .from(clientInteractions)
        .where(
          and(
            interactionCondition,
            gte(clientInteractions.createdAt, previousMonthStart),
            lte(clientInteractions.createdAt, previousMonthEnd)
          )
        ),
    ]);

    // Process results
    const totalClients = clientCount[0]?.count || 0;
    const totalCompanies = companyCount[0]?.count || 0;
    const totalUsers = userCount[0]?.count || 0;
    const totalSectors = sectorCount[0]?.count || 0;

    // Process category stats
    const clientsByCategory = clientsByCategoryStats.map((item) => ({
      category: item.category || "Sem categoria",
      count: item.count,
    }));

    // Process origin stats
    const clientsByOrigin = clientsByOriginStats.map((item) => ({
      origin: item.origin || "Sem origem",
      count: item.count,
    }));

    // Process user stats
    const clientsByUser = clientsByUserStats.map((item) => ({
      userId: item.userId,
      userName: item.userName || "Sem responsável",
      count: item.count,
    }));

    // Process sector stats
    const companiesBySector = companiesBySectorStats.map((item) => ({
      sectorId: item.sectorId,
      sectorName: item.sectorName || "Sem setor",
      count: item.count,
    }));

    // Current month stats
    const newClientsThisMonthCount = newClientsThisMonth[0]?.count || 0;
    const newCompaniesThisMonthCount = newCompaniesThisMonth[0]?.count || 0;
    const totalInteractionsThisMonth = interactionsThisMonth[0]?.count || 0;

    // Previous month stats for comparison
    const newClientsPreviousMonthCount = newClientsPreviousMonth[0]?.count || 0;
    const newCompaniesPreviousMonthCount =
      newCompaniesPreviousMonth[0]?.count || 0;
    const totalInteractionsPreviousMonth =
      interactionsPreviousMonth[0]?.count || 0;

    // Calculate growth percentages
    const clientGrowthPercent =
      newClientsPreviousMonthCount > 0
        ? ((newClientsThisMonthCount - newClientsPreviousMonthCount) /
            newClientsPreviousMonthCount) *
          100
        : newClientsThisMonthCount > 0
        ? 100
        : 0;

    const companyGrowthPercent =
      newCompaniesPreviousMonthCount > 0
        ? ((newCompaniesThisMonthCount - newCompaniesPreviousMonthCount) /
            newCompaniesPreviousMonthCount) *
          100
        : newCompaniesThisMonthCount > 0
        ? 100
        : 0;

    const interactionGrowthPercent =
      totalInteractionsPreviousMonth > 0
        ? ((totalInteractionsThisMonth - totalInteractionsPreviousMonth) /
            totalInteractionsPreviousMonth) *
          100
        : totalInteractionsThisMonth > 0
        ? 100
        : 0;

    const reportData: GeneralReportsData = {
      totalClients,
      totalCompanies,
      totalUsers,
      totalSectors,
      clientsByCategory,
      clientsByOrigin,
      clientsByUser,
      companiesBySector,
      recentStats: {
        newClientsThisMonth: newClientsThisMonthCount,
        newCompaniesThisMonth: newCompaniesThisMonthCount,
        totalInteractionsThisMonth,
      },
      growthStats: {
        clientGrowthPercent: Math.round(clientGrowthPercent * 100) / 100,
        companyGrowthPercent: Math.round(companyGrowthPercent * 100) / 100,
        interactionGrowthPercent:
          Math.round(interactionGrowthPercent * 100) / 100,
      },
    };

    res.json(reportData);
  } catch (error) {
    console.error("Error generating general reports:", error);
    res.status(500).json({
      message: "Erro ao gerar relatórios gerais",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
