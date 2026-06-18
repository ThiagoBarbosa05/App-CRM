import { Router, type Request, type Response } from "express";
import { listFlows, syncFlowsFromMeta } from "../services/whatsapp-flows.service";

const router = Router();

router.get("/flows", async (req: Request, res: Response) => {
  try {
    const flows = await listFlows();
    res.json(flows);
  } catch (err) {
    console.error("[WA Flows] Erro ao listar flows:", err);
    res.status(500).json({ error: "Erro ao listar flows" });
  }
});

router.post("/flows/sync", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId?: string }).userId ?? "";
    const count = await syncFlowsFromMeta(userId);
    res.json({ synced: count });
  } catch (err) {
    console.error("[WA Flows] Erro ao sincronizar flows:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
