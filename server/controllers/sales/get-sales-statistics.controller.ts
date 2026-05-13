import { Request, Response } from "express";
import { sql, gte, and, lt } from "drizzle-orm";
import { db } from "../../db";
import { sales } from "../../../shared/schema";

interface SalesStatistics {
  salesCount: number;
  totalSales: number;
  totalCashbackUsed: number;
  totalCashbackGenerated: number;
  netValue: number;
  averageSaleValue: number;
  period: string;
  prevMonthSalesCount: number;
  prevMonthTotalSales: number;
  sameMonthLastYearSalesCount: number;
  sameMonthLastYearTotalSales: number;
}

async function fetchAggregates(startDate: Date, endDate?: Date) {
  const conditions = endDate
    ? and(gte(sales.date, startDate), lt(sales.date, endDate))
    : gte(sales.date, startDate);

  const result = await db
    .select({
      salesCount: sql<number>`count(*)::int`,
      totalSales: sql<number>`coalesce(sum(${sales.grossValue}), 0)`,
      totalCashbackUsed: sql<number>`coalesce(sum(${sales.cashbackUsed}), 0)`,
      totalCashbackGenerated: sql<number>`coalesce(sum(${sales.cashbackGenerated}), 0)`,
      netValue: sql<number>`coalesce(sum(${sales.netValue}), 0)`,
      averageSaleValue: sql<number>`coalesce(avg(${sales.grossValue}), 0)`,
    })
    .from(sales)
    .where(conditions);

  return result[0];
}

export async function getSalesStatisticsController(
  req: Request,
  res: Response
) {
  try {
    const { days = "30" } = req.query;
    const daysNumber = parseInt(days as string) || 30;

    const now = new Date();

    // Período atual: últimos N dias
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - daysNumber);
    currentStart.setHours(0, 0, 0, 0);

    // Período anterior: N dias antes do período atual
    const prevMonthEnd = new Date(currentStart);
    const prevMonthStart = new Date(currentStart);
    prevMonthStart.setDate(prevMonthStart.getDate() - daysNumber);
    prevMonthStart.setHours(0, 0, 0, 0);

    // Mesmo mês do ano anterior
    const sameMonthLastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    sameMonthLastYearStart.setHours(0, 0, 0, 0);
    const sameMonthLastYearEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    sameMonthLastYearEnd.setHours(0, 0, 0, 0);

    const [current, prevMonth, sameMonthLastYear] = await Promise.all([
      fetchAggregates(currentStart),
      fetchAggregates(prevMonthStart, prevMonthEnd),
      fetchAggregates(sameMonthLastYearStart, sameMonthLastYearEnd),
    ]);

    const response: SalesStatistics = {
      salesCount: current.salesCount,
      totalSales: parseFloat(current.totalSales.toString()),
      totalCashbackUsed: parseFloat(current.totalCashbackUsed.toString()),
      totalCashbackGenerated: parseFloat(current.totalCashbackGenerated.toString()),
      netValue: parseFloat(current.netValue.toString()),
      averageSaleValue: parseFloat(current.averageSaleValue.toString()),
      period: `${daysNumber} days`,
      prevMonthSalesCount: prevMonth.salesCount,
      prevMonthTotalSales: parseFloat(prevMonth.totalSales.toString()),
      sameMonthLastYearSalesCount: sameMonthLastYear.salesCount,
      sameMonthLastYearTotalSales: parseFloat(sameMonthLastYear.totalSales.toString()),
    };

    res.json({
      success: true,
      data: response,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas de vendas:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar estatísticas de vendas",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
