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

/**
 * Traz mais cards do backlog para a fila visível.
 *
 * Admin/gerente pode promover na fila de outro via ?sellerId — mesma regra de
 * GET /feed. A promoção é do dono da fila, não de quem clica: o card promovido
 * aparece para o vendedor, e a mensagem da IA é redigida em nome dele.
 */
copilotoRouter.post(
  "/load-more",
  requireAuth,
  async (req: Request, res: Response) => {
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

      const result = await loadMoreFromBacklog(requestedSellerId ?? user.userId);
      return res.json(result);
    } catch (error) {
      console.error("[copiloto] Erro ao carregar mais cards:", error);
      return res.status(500).json({ message: "Erro ao carregar mais cards" });
    }
  },
);

/** Dispara a varredura completa (todos os vendedores) — normal é o cron das 9h. */
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

    console.log(`[copiloto] Varredura manual completa disparada por ${user.userId}...`);
    const result = await scanCopilotoSignals();
    console.log(`[copiloto] Concluída: ${result.generated} card(s) gerados.`);

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[copiloto] Erro na varredura:", error);
    return res.status(500).json({ message: "Erro ao gerar fila do Copiloto" });
  }
});

/**
 * Gera (ou regenera) a fila de um vendedor específico.
 * Só admins/gerentes podem chamar. Não afeta a fila dos demais.
 */
copilotoRouter.post("/scan-seller", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const isManager =
      user.role === "admin" ||
      user.role === "administrador" ||
      user.role === "gerente";

    if (!isManager) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const { sellerId } = req.body ?? {};
    if (typeof sellerId !== "string" || !sellerId) {
      return res.status(400).json({ message: "sellerId é obrigatório" });
    }

    console.log(`[copiloto] Regenerando fila do vendedor ${sellerId} (solicitado por ${user.userId})...`);
    const result = await scanCopilotoSignals({ sellerId });
    console.log(`[copiloto] Fila de ${sellerId}: ${result.generated} card(s) gerados.`);

    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[copiloto] Erro na varredura por vendedor:", error);
    return res.status(500).json({ message: "Erro ao gerar fila do vendedor" });
  }
});

export default copilotoRouter;
