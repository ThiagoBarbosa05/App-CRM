import { Request, Response } from "express";
import { getMarketingSummary } from "../../services/marketing-summary.service";

export async function getMarketingSummaryController(req: Request, res: Response) {
  try {
    const summary = await getMarketingSummary();
    res.json(summary);
  } catch (error) {
    console.error("Erro ao buscar resumo de marketing:", error);
    res.status(500).json({ message: "Erro ao buscar resumo de marketing" });
  }
}
