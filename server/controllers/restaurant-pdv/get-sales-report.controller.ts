import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";
import { saoPauloRange } from "../../../shared/sao-paulo-date";
import { reportRangeSchema, resolveReportRange } from "./report-range.schema";

export const getSalesReportController = async (req: Request, res: Response) => {
  try {
    // Sem unidade o relatório somaria as vendas de todas as unidades. O
    // middleware já resolve isso nesta rota; a guarda é o que dá `string` ao
    // serviço sem `!`.
    if (!req.pdvUnitId) {
      return res.status(400).json({ message: "Selecione uma unidade PDV para continuar." });
    }

    const parsed = reportRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { fromIso, toIso } = resolveReportRange(parsed.data);
    const { from, to } = saoPauloRange(fromIso, toIso);

    const report = await restaurantReportsService.getSalesReport({
      from,
      to,
      unitId: req.pdvUnitId,
    });
    return res.json(report);
  } catch (error) {
    console.error("Erro ao buscar relatório de vendas:", error);
    return res.status(500).json({ message: "Erro ao buscar relatório de vendas" });
  }
};
