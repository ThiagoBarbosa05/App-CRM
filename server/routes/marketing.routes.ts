import { Router } from "express";
import { getMarketingSummaryController } from "../controllers/marketing/summary.controller";

export const marketingRouter = Router();

/**
 * @route GET /api/marketing/summary
 * @description Contadores de envio por canal (WhatsApp/Email/SMS) dos últimos 30 dias
 * @access Private
 */
marketingRouter.get("/summary", getMarketingSummaryController);
