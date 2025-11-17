import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

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

    const result = await cashbackStatisticsService.getCashbackUsageList({
      search,
      userId,
      authorizedById,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
      page: pageNum,
      limit: limitNum,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar resgates de cashback:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar resgates de cashback",
    });
  }
}
