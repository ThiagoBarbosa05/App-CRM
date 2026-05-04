import { Request, Response } from "express";
import { getAggregateSummaryData } from "../../services/seller-dashboard.service";

export async function getAggregateSummaryController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    const data = await getAggregateSummaryData(startDate, endDate);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateSummaryController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
