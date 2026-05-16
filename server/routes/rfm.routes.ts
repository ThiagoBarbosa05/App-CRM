import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/validation";
import { calculateRfm, getRfmSummary } from "../services/rfm.service";

const rfmRouter = Router();

rfmRouter.post("/recalculate", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isAdminOrManager =
      user.role === "admin" ||
      user.role === "administrador" ||
      user.role === "gerente";

    if (!isAdminOrManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    console.log(`[rfm] Recalculando RFM por ${user.userId}...`);
    const result = await calculateRfm();
    console.log(`[rfm] Concluído: ${result.updated} clientes atualizados`);

    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[rfm] Erro ao recalcular:", e);
    return res.status(500).json({ message: "Erro ao recalcular RFM" });
  }
});

rfmRouter.get("/summary", requireAuth, async (_req: Request, res: Response) => {
  try {
    const summary = await getRfmSummary();
    return res.json(summary);
  } catch (e) {
    console.error("[rfm] Erro ao buscar resumo:", e);
    return res.status(500).json({ message: "Erro ao buscar resumo RFM" });
  }
});

export default rfmRouter;
