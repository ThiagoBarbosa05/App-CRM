import { Request, Response } from "express";
import { db } from "../../db";
import { companies, sectors, users } from "@shared/schema";
import { sql, count, eq, and, isNull } from "drizzle-orm";

export interface CompanyReportsData {
  totalCompanies: number;
  companiesBySector: Array<{
    sectorId: string | null;
    sectorName: string;
    count: number;
  }>;
  companiesByUser: Array<{
    userId: string | null;
    userName: string;
    count: number;
  }>;
  companiesByState: Array<{
    state: string | null;
    count: number;
  }>;
  companiesByCity: Array<{
    city: string | null;
    count: number;
  }>;
  companiesActive: number;
  companiesInactive: number;
  companiesWithCNPJ: number;
  companiesWithoutCNPJ: number;
}

/**
 * Get comprehensive company reports data
 * Optimized with efficient database queries
 */
export const getCompanyReportsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    // Base condition for companies based on user role
    let baseCondition = sql`1=1`;

    // If not admin, filter by responsible user
    if (userRole !== "admin" && userId) {
      baseCondition = eq(companies.responsavelId, userId);
    }

    // Execute all queries in parallel for better performance
    const [
      totalResult,
      sectorStats,
      userStats,
      stateStats,
      cityStats,
      activeInactiveStats,
      cnpjStats,
    ] = await Promise.all([
      // Total companies count
      db.select({ count: count() }).from(companies).where(baseCondition),

      // Companies by sector
      db
        .select({
          sectorId: companies.sectorId,
          sectorName: sectors.name,
          count: count(),
        })
        .from(companies)
        .leftJoin(sectors, eq(companies.sectorId, sectors.id))
        .where(baseCondition)
        .groupBy(companies.sectorId, sectors.name)
        .orderBy(count()),

      // Companies by responsible user
      db
        .select({
          userId: companies.responsavelId,
          userName: users.name,
          count: count(),
        })
        .from(companies)
        .leftJoin(users, eq(companies.responsavelId, users.id))
        .where(baseCondition)
        .groupBy(companies.responsavelId, users.name)
        .orderBy(count()),

      // Companies by state
      db
        .select({
          state: companies.state,
          count: count(),
        })
        .from(companies)
        .where(baseCondition)
        .groupBy(companies.state)
        .orderBy(count()),

      // Companies by city (top 10)
      db
        .select({
          city: companies.city,
          count: count(),
        })
        .from(companies)
        .where(baseCondition)
        .groupBy(companies.city)
        .orderBy(sql`${count()} DESC`)
        .limit(10),

      // Active vs Inactive companies
      db
        .select({
          active: companies.active,
          count: count(),
        })
        .from(companies)
        .where(baseCondition)
        .groupBy(companies.active),

      // Companies with/without CNPJ
      db
        .select({
          hasCnpj: sql<boolean>`CASE WHEN ${companies.cnpj} IS NOT NULL AND ${companies.cnpj} != '' THEN true ELSE false END`,
          count: count(),
        })
        .from(companies)
        .where(baseCondition)
        .groupBy(
          sql`CASE WHEN ${companies.cnpj} IS NOT NULL AND ${companies.cnpj} != '' THEN true ELSE false END`
        ),
    ]);

    // Process and format results
    const totalCompanies = totalResult[0]?.count || 0;

    const companiesBySector = sectorStats.map((item) => ({
      sectorId: item.sectorId,
      sectorName: item.sectorName || "Sem setor",
      count: item.count,
    }));

    const companiesByUser = userStats.map((item) => ({
      userId: item.userId,
      userName: item.userName || "Sem responsável",
      count: item.count,
    }));

    const companiesByState = stateStats.map((item) => ({
      state: item.state || "Sem estado",
      count: item.count,
    }));

    const companiesByCity = cityStats.map((item) => ({
      city: item.city || "Sem cidade",
      count: item.count,
    }));

    // Process active/inactive stats
    let companiesActive = 0;
    let companiesInactive = 0;

    activeInactiveStats.forEach((stat) => {
      if (stat.active === true) {
        companiesActive = stat.count;
      } else {
        companiesInactive = stat.count;
      }
    });

    // Process CNPJ stats
    let companiesWithCNPJ = 0;
    let companiesWithoutCNPJ = 0;

    cnpjStats.forEach((stat) => {
      if (stat.hasCnpj === true) {
        companiesWithCNPJ = stat.count;
      } else {
        companiesWithoutCNPJ = stat.count;
      }
    });

    const reportData: CompanyReportsData = {
      totalCompanies,
      companiesBySector,
      companiesByUser,
      companiesByState,
      companiesByCity,
      companiesActive,
      companiesInactive,
      companiesWithCNPJ,
      companiesWithoutCNPJ,
    };

    res.json(reportData);
  } catch (error) {
    console.error("Error generating company reports:", error);
    res.status(500).json({
      message: "Erro ao gerar relatórios de empresas",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
