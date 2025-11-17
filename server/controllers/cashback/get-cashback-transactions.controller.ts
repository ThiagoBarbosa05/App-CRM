import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

interface CashbackTransactionsFilters {
  search?: string;
  status?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
  sortBy?:
    | "clientName"
    | "cashbackAmount"
    | "purchaseAmount"
    | "cashbackRate"
    | "saleDate"
    | "status"
    | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Controller para buscar transações de cashback
 * Suporta filtros avançados, busca, ordenação e paginação
 */
export async function getCashbackTransactionsController(
  req: Request,
  res: Response
) {
  try {
    const {
      search,
      status,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query as CashbackTransactionsFilters;

    // Converter tipos
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    // Chamar service
    const result = await cashbackStatisticsService.getCashbackTransactionsList(
      search,
      status,
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
      pageNum,
      limitNum
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar transações de cashback:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar transações de cashback",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
