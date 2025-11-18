import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

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
      compareWithPrevious = false,
    } = req.query as unknown as PerformanceFilters;

    // Definir intervalo de datas padrão se não fornecido (últimos 30 dias)
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const actualStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const actualEndDate = endDate ? new Date(endDate) : defaultEndDate;

    const result = await cashbackStatisticsService.getCashbackPerformance({
      startDate: actualStartDate,
      endDate: actualEndDate,
      sellerId,
      periodType: periodType as "daily" | "weekly" | "monthly",
      compareWithPrevious:
        compareWithPrevious === true || compareWithPrevious === "true",
    });

    const response = {
      ...result,
      filters: {
        startDate: actualStartDate.toISOString(),
        endDate: actualEndDate.toISOString(),
        sellerId,
        periodType,
        compareWithPrevious,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching cashback performance:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar métricas de performance de cashback",
    });
  }
}
