import { Request, Response } from "express";
import { storage } from "../../storage";

interface CashbackStatistics {
  totalCashback: number;
  activeClients: number;
  averageRate: number;
  totalClients: number;
  totalTransactions: number;
  totalSettings: number;
}

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

    // Buscar todas as transações de cashback aprovadas
    const transactions = await storage.getCashbackTransactions();

    // Calcular total de cashback distribuído (apenas transações aprovadas)
    const totalCashback = transactions.reduce((sum: number, item: any) => {
      const transaction = item.cashback_transactions || item;
      if (transaction.status === "approved") {
        return sum + parseFloat(transaction.cashbackAmount || 0);
      }
      return sum;
    }, 0);

    // Buscar saldos de cashback para contar clientes ativos
    const balances = await storage.getAllCashbackBalances();

    // Contar clientes com saldo de cashback disponível
    const activeClients = balances.filter(
      (balance: any) => parseFloat(balance.currentBalance || 0) > 0
    ).length;

    // Total de clientes que já tiveram cashback (com ou sem saldo atual)
    const totalClients = balances.length;

    // Buscar configurações de cashback para calcular taxa média
    const settings = await storage.getCashbackSettings();

    // Calcular taxa média das configurações ativas
    const activeSettings = settings.filter(
      (setting: any) => setting.isActive === "true"
    );
    const averageRate =
      activeSettings.length > 0
        ? activeSettings.reduce(
            (sum: number, setting: any) =>
              sum + parseFloat(setting.percentageRate || 0),
            0
          ) / activeSettings.length
        : 0;

    // Total de transações
    const totalTransactions = transactions.length;

    // Total de configurações
    const totalSettings = settings.length;

    const statistics: CashbackStatistics = {
      totalCashback,
      activeClients,
      averageRate,
      totalClients,
      totalTransactions,
      totalSettings,
    };

    console.log("Estatísticas calculadas:", {
      totalCashback: `R$ ${totalCashback.toFixed(2)}`,
      activeClients,
      averageRate: `${averageRate.toFixed(2)}%`,
      totalClients,
      totalTransactions,
      totalSettings,
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
