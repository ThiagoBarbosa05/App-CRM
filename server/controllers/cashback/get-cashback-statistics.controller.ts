import { Request, Response } from "express";
import { cashbackStatisticsService } from "../../services/cashback-statistics.service";

/**
 * Controller para buscar estatísticas gerais do sistema de cashback
 * Retorna métricas essenciais para o dashboard
 */
export const getCashbackStatisticsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Buscando estatísticas de cashback...");

    const statistics = await cashbackStatisticsService.calculateStatistics();

    console.log("Estatísticas calculadas:", {
      totalCashback: `R$ ${statistics.totalCashback.toFixed(2)}`,
      activeClients: statistics.activeClients,
      averageRate: `${statistics.averageRate.toFixed(2)}%`,
      totalClients: statistics.totalClients,
      totalTransactions: statistics.totalTransactions,
      totalSettings: statistics.totalSettings,
    });

    res.json(statistics);
  } catch (error) {
    console.error("Erro ao buscar estatísticas de cashback:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao buscar estatísticas de cashback",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};
