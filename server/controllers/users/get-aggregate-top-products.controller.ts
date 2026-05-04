import { Request, Response } from "express";
import { getAggregateTopProductsData } from "../../services/seller-dashboard.service";

export async function getAggregateTopProductsController(req: Request, res: Response) {
  try {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    const data = await getAggregateTopProductsData(startDate, endDate);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("[getAggregateTopProductsController] Erro:", error);
    return res.status(500).json({ success: false, error: "Erro interno" });
  }
}
