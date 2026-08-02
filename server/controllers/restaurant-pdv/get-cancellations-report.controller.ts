import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";
import { saoPauloRange } from "../../../shared/sao-paulo-date";
import { reportRangeSchema, resolveReportRange } from "./report-range.schema";

export const getCancellationsReportController = async (req: Request, res: Response) => {
  try {
    if (!req.pdvUnitId) {
      return res.status(400).json({ message: "Selecione uma unidade PDV para continuar." });
    }

    const parsed = reportRangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { fromIso, toIso } = resolveReportRange(parsed.data);
    const { from, to } = saoPauloRange(fromIso, toIso);

    // A agregação mora no serviço: quando ela era feita aqui, rodava sobre a
    // lista que a query já tinha truncado em 200 e o total saía menor que o
    // real, sem aviso.
    const report = await restaurantReportsService.getCancellationsReport({
      from,
      to,
      unitId: req.pdvUnitId,
    });
    return res.json(report);
  } catch (error) {
    console.error("Erro ao buscar relatório de cancelamentos:", error);
    return res.status(500).json({ message: "Erro ao buscar relatório de cancelamentos" });
  }
};
