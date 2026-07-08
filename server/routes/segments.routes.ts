import { Router, Request, Response } from "express";
import { segmentsService } from "../services/segments.service";

export const segmentsRouter = Router();

/**
 * GET /api/segments/overview
 * Retorna os grupos de segmentos da base de clientes com a contagem de cada um.
 * Uso administrativo (a página consumidora já é restrita a admin no frontend).
 */
segmentsRouter.get("/overview", async (_req: Request, res: Response) => {
  try {
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
