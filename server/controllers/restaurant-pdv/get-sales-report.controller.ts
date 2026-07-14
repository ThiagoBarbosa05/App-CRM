import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";

export const getSalesReportController = async (req: Request, res: Response) => {
  try {
    const toParam = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const fromParam =
      (req.query.from as string) ||
      new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const from = new Date(`${fromParam}T00:00:00-03:00`);
    const to = new Date(`${toParam}T23:59:59.999-03:00`);

    const report = await restaurantReportsService.getSalesReport({ from, to });
    return res.json(report);
  } catch (error) {
    console.error("Erro ao buscar relatório de vendas:", error);
    return res.status(500).json({ message: "Erro ao buscar relatório de vendas" });
  }
};
