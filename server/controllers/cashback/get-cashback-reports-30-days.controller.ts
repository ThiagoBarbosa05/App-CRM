import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar relatórios de cashback dos últimos 30 dias
 *
 * @route GET /api/cashback-reports/30-days
 * @description Retorna estatísticas agregadas de cashback dos últimos 30 dias,
 * incluindo vendas, cashback gerado, cashback usado e resgates
 * @access Private
 *
 * @returns {Object} Estatísticas de cashback dos últimos 30 dias
 *
 * @example Response (200)
 * {
 *   "totalSales": 15000.00,
 *   "totalCashbackGenerated": 1500.00,
 *   "totalCashbackUsed": 500.00,
 *   "totalCashbackRedeemed": 300.00,
 *   "salesCount": 45,
 *   "period": "30 days"
 * }
 *
 * @throws {500} Erro ao buscar relatórios de cashback
 */
export const getCashbackReports30DaysController = async (
  req: Request,
  res: Response
) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar vendas dos últimos 30 dias
    const sales = await storage.getSales();
    const recentSales = sales.filter(
      (sale) => new Date(sale.date) >= thirtyDaysAgo
    );

    // Buscar transações de cashback dos últimos 30 dias
    const transactions = await storage.getCashbackTransactions();
    const recentTransactions = transactions.filter((item: any) => {
      const transaction = item.cashback_transactions || item;
      return (
        new Date(transaction.createdAt) >= thirtyDaysAgo &&
        transaction.status === "approved"
      );
    });

    // Buscar resgates dos últimos 30 dias
    const allUsage = await storage.getAllCashbackUsage();
    const recentUsage = allUsage.filter((item: any) => {
      const usage = item.cashback_usage || item;
      return new Date(usage.createdAt) >= thirtyDaysAgo;
    });

    // Calcular totais
    const totalSales = recentSales.reduce(
      (sum, sale) => sum + parseFloat(sale.grossValue),
      0
    );
    const totalCashbackGenerated = recentSales.reduce(
      (sum, sale) => sum + parseFloat(sale.cashbackGenerated),
      0
    );
    const totalCashbackUsed = recentSales.reduce(
      (sum, sale) => sum + parseFloat(sale.cashbackUsed),
      0
    );
    const totalCashbackRedeemed = recentUsage.reduce((sum, item) => {
      const usage = (item as any).cashback_usage || item;
      return sum + parseFloat(usage.usedAmount || 0);
    }, 0);

    res.json({
      totalSales,
      totalCashbackGenerated,
      totalCashbackUsed,
      totalCashbackRedeemed,
      salesCount: recentSales.length,
      period: "30 days",
    });
  } catch (error) {
    console.error("Erro ao buscar relatórios de cashback:", error);
    res.status(500).json({ message: "Erro ao buscar relatórios de cashback" });
  }
};
