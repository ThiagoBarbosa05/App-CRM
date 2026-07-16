import { Router, Request, Response } from "express";

import { requireAuth } from "../middleware/validation";
import {
  actOnSignal,
  getCopilotoFeed,
  loadMoreFromBacklog,
  scanCopilotoSignals,
  type CopilotoAction,
} from "../services/copiloto.service";

const copilotoRouter = Router();

const VALID_ACTIONS: CopilotoAction[] = ["done", "snoozed", "dismissed"];

/** Fila do vendedor logado. Admin/gerente pode inspecionar a de outro via ?sellerId. */
copilotoRouter.get("/feed", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isManager =
      user.role === "admin" ||
      user.role === "administrador" ||
      user.role === "gerente";

    const requestedSellerId =
      typeof req.query.sellerId === "string" ? req.query.sellerId : null;

    if (requestedSellerId && requestedSellerId !== user.userId && !isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const feed = await getCopilotoFeed(requestedSellerId ?? user.userId);
    return res.json(feed);
  } catch (error) {
    console.error("[copiloto] Erro ao buscar fila:", error);
    return res.status(500).json({ message: "Erro ao buscar fila do Copiloto" });
  }
});

/** Marca um card como trabalhado, adiado ou recusado. */
copilotoRouter.post(
  "/signals/:id/action",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { action, dismissReason, snoozeDays } = req.body ?? {};

      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({
          message: `Ação inválida. Use uma de: ${VALID_ACTIONS.join(", ")}`,
        });
      }

      const parsedSnoozeDays =
        typeof snoozeDays === "number" && snoozeDays > 0 && snoozeDays <= 30
          ? snoozeDays
          : undefined;

      const ok = await actOnSignal({
        signalId: req.params.id,
        sellerId: user.userId,
        action,
        dismissReason:
          typeof dismissReason === "string" ? dismissReason : undefined,
        snoozeDays: parsedSnoozeDays,
      });

      if (!ok) {
        return res
          .status(404)
          .json({ message: "Card não encontrado ou já trabalhado" });
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error("[copiloto] Erro ao registrar ação:", error);
      return res.status(500).json({ message: "Erro ao registrar ação" });
    }
  },
);

/** Traz mais cards do backlog do próprio vendedor para a fila visível. */
copilotoRouter.post(
  "/load-more",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const result = await loadMoreFromBacklog(user.userId);
      return res.json(result);
    } catch (error) {
      console.error("[copiloto] Erro ao carregar mais cards:", error);
      return res.status(500).json({ message: "Erro ao carregar mais cards" });
    }
  },
);

/** Dispara a varredura manualmente (o normal é o cron das 5h). */
copilotoRouter.post("/scan", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isManager =
      user.role === "admin" ||
      user.role === "administrador" ||
      user.role === "gerente";

    if (!isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    console.log(`[copiloto] Varredura manual disparada por ${user.userId}...`);
    const result = await scanCopilotoSignals();
    console.log(`[copiloto] Concluída: ${result.generated} card(s) gerados.`);

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[copiloto] Erro na varredura:", error);
    return res.status(500).json({ message: "Erro ao gerar fila do Copiloto" });
  }
});

export default copilotoRouter;
