import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

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
      sortOrder = "desc",
    } = req.query as unknown as ReportsFilters;

    const result = await cashbackStatisticsService.getCashbackReports({
      search,
      startDate,
      endDate,
      sellerId,
      clientId,
    });

    const response = {
      ...result,
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
        sortOrder,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching cashback reports:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao buscar relatórios de cashback",
    });
  }
}
