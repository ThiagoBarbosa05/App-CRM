import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

interface ExpiringCashbacksQuery {
  search?: string;
  sortBy?: "amount" | "expiresAt" | "clientName" | "sellerName";
  sortOrder?: "asc" | "desc";
  limit?: string;
  offset?: string;
}

/**
 * Controller para buscar cashbacks que estão próximos de expirar
 * Retorna cashbacks aprovados que vencem nos próximos 7 dias
 */
export async function getExpiringCashbacks(req: Request, res: Response) {
  try {
    const {
      search = "",
      sortBy = "expiresAt",
      sortOrder = "asc",
      limit = "50",
      offset = "0",
    } = req.query as ExpiringCashbacksQuery;

    const result = await cashbackStatisticsService.getExpiringCashbacks(
      search,
      sortBy as "amount" | "expiresAt" | "clientName" | "sellerName",
      sortOrder as "asc" | "desc",
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Erro ao buscar cashbacks vencendo:", error);
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar cashbacks vencendo",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}
