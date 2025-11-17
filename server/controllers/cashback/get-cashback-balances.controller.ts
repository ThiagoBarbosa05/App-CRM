import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

interface CashbackBalancesQuery {
  search?: string;
  userId?: string;
  minBalance?: string;
  maxBalance?: string;
  sortBy?:
    | "clientName"
    | "currentBalance"
    | "totalEarned"
    | "totalUsed"
    | "sellerName"
    | "lastUpdated";
  sortOrder?: "asc" | "desc";
  page?: string;
  limit?: string;
}

/**
 * Controller para buscar saldos de cashback dos clientes
 * Suporta filtros avançados, busca, ordenação e paginação
 */
export async function getCashbackBalancesController(
  req: Request,
  res: Response
) {
  try {
    const {
      search = "",
      userId,
      minBalance,
      maxBalance,
      sortBy = "currentBalance",
      sortOrder = "desc",
      page = "1",
      limit = "20",
    } = req.query as CashbackBalancesQuery;

    // Converter tipos
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 100);

    // Chamar service
    const result = await cashbackStatisticsService.getCashbackBalances(
      search,
      userId,
      minBalance,
      maxBalance,
      sortBy,
      sortOrder,
      pageNum,
      limitNum
    );

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar saldos de cashback:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar saldos de cashback",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
