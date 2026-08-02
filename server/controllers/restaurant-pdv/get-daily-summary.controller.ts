import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";
import { todayInSaoPaulo } from "../../../shared/sao-paulo-date";
import { reportDateSchema } from "./report-range.schema";

export const getDailySummaryController = async (req: Request, res: Response) => {
  try {
    if (!req.pdvUnitId) {
      return res.status(400).json({ message: "Selecione uma unidade PDV para continuar." });
    }

    const parsed = reportDateSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    // O default é o dia de São Paulo, não o de UTC: entre 21h e meia-noite o
    // UTC já virou, e o resumo abria em "amanhã" no pico do restaurante.
    const date = parsed.data.date ?? todayInSaoPaulo();

    const summary = await restaurantReportsService.getDailySummary({
      date,
      unitId: req.pdvUnitId,
    });
    return res.json(summary);
  } catch (error) {
    console.error("Erro ao buscar fechamento de caixa:", error);
    return res.status(500).json({ message: "Erro ao buscar fechamento de caixa" });
  }
};
