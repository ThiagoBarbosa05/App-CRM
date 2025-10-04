import { Request, Response } from "express";
import { sql, gte } from "drizzle-orm";
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
}

export async function getSalesStatisticsController(
  req: Request,
  res: Response
) {
  try {
    const { days = "30" } = req.query;

    // Calcular data de início baseada nos dias solicitados
    const daysNumber = parseInt(days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNumber);
    startDate.setHours(0, 0, 0, 0);

    // Query otimizada para buscar estatísticas agregadas em uma única consulta
    const statisticsQuery = await db
      .select({
        salesCount: sql<number>`count(*)::int`,
        totalSales: sql<number>`coalesce(sum(${sales.grossValue}), 0)`,
        totalCashbackUsed: sql<number>`coalesce(sum(${sales.cashbackUsed}), 0)`,
        totalCashbackGenerated: sql<number>`coalesce(sum(${sales.cashbackGenerated}), 0)`,
        netValue: sql<number>`coalesce(sum(${sales.netValue}), 0)`,
        averageSaleValue: sql<number>`coalesce(avg(${sales.grossValue}), 0)`,
      })
      .from(sales)
      .where(gte(sales.date, startDate));

    const statistics = statisticsQuery[0];

    const response: SalesStatistics = {
      salesCount: statistics.salesCount,
      totalSales: parseFloat(statistics.totalSales.toString()),
      totalCashbackUsed: parseFloat(statistics.totalCashbackUsed.toString()),
      totalCashbackGenerated: parseFloat(
        statistics.totalCashbackGenerated.toString()
      ),
      netValue: parseFloat(statistics.netValue.toString()),
      averageSaleValue: parseFloat(statistics.averageSaleValue.toString()),
      period: `${daysNumber} days`,
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
