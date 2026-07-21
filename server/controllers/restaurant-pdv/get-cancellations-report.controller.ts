import { Request, Response } from "express";
import { restaurantReportsService } from "../../services/restaurant-reports.service";
import { summarizeCancellations } from "../../../shared/restaurant-cancellations";

export const getCancellationsReportController = async (req: Request, res: Response) => {
  try {
    const toParam = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const fromParam =
      (req.query.from as string) ||
      new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Mesma convenção do relatório de vendas: o dia é o dia de São Paulo.
    const from = new Date(`${fromParam}T00:00:00-03:00`);
    const to = new Date(`${toParam}T23:59:59.999-03:00`);

    const items = await restaurantReportsService.listCancelledItems({ from, to });

    return res.json({
      ...summarizeCancellations(items),
      items,
    });
  } catch (error) {
    console.error("Erro ao buscar relatório de cancelamentos:", error);
    return res.status(500).json({ message: "Erro ao buscar relatório de cancelamentos" });
  }
};
