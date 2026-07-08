import { Router, Request, Response } from "express";
import { segmentsService } from "../services/segments.service";
import { requireAuth } from "../middleware/validation";

export const segmentsRouter = Router();

segmentsRouter.get("/overview", requireAuth, async (_req: Request, res: Response) => {
  try {
    res.set("Cache-Control", "no-store");
    const overview = await segmentsService.getOverview();
    return res.json(overview);
  } catch (error) {
    console.error("[segments] Erro ao gerar overview:", error);
    return res
      .status(500)
      .json({ message: "Erro ao carregar segmentos da base" });
  }
});

export default segmentsRouter;
