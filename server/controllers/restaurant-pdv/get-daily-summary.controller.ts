import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";

export const getDailySummaryController = async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const summary = await restaurantReportsService.getDailySummary(date);
    return res.json(summary);
  } catch (error) {
    console.error("Erro ao buscar fechamento de caixa:", error);
    return res.status(500).json({ message: "Erro ao buscar fechamento de caixa" });
  }
};
