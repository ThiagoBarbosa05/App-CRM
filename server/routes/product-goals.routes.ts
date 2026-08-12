import { Router, Request, Response } from "express";
import { z } from "zod";
import { bulkProductGoalSchema, type GoalPeriod } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";
import {
  goalPeriodParamsSchema,
  isManagerRole,
  validateGoalParams,
} from "./goal-route-validation";

export const productGoalsRouter = Router();

productGoalsRouter.get(
  "/:month/:year",
  requireAuth,
  validateGoalParams(goalPeriodParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.params as unknown as GoalPeriod;
      const user = req.user!;

      const goals = await storage.getProductGoalsByPeriod(month, year);

      // Vendedor só vê as metas atribuídas a ele; admin/gerente vê tudo.
      const filtered = isManagerRole(user.role)
        ? goals
        : goals.filter((g: { userId: string }) => g.userId === user.userId);

      return res.json(filtered);
    } catch (error) {
      console.error("Erro ao buscar metas de produto:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de produto" });
    }
  },
);

productGoalsRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const schema = z.object({
      userId: z.string().min(1, "Vendedor obrigatório"),
      month: z.coerce.number().min(1).max(12),
      year: z.coerce.number().min(2000),
      productId: z.string().min(1, "Produto obrigatório"),
      productGoalQty: z.coerce.number().int().min(1, "Mínimo 1 unidade"),
    });
    const data = schema.parse(req.body);
    const goal = await storage.createProductGoal(data);
    return res.status(201).json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Erro ao criar meta de produto:", error);
    return res.status(500).json({ message: "Erro ao criar meta de produto" });
  }
});

productGoalsRouter.post("/bulk", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const data = bulkProductGoalSchema.parse(req.body);

    // Evita duplicar (userId, productId) já existente no período.
    const existing = await storage.getProductGoalsByPeriod(data.month, data.year);
    const alreadyGoaled = new Set(
      existing
        .filter((g: { productId: string }) => g.productId === data.productId)
        .map((g: { userId: string }) => g.userId),
    );

    const toCreate = data.userIds.filter((id) => !alreadyGoaled.has(id));
    const skipped = data.userIds.filter((id) => alreadyGoaled.has(id));

    const created =
      toCreate.length > 0
        ? await storage.createProductGoalsBulk(
            toCreate.map((userId) => ({
              userId,
              month: data.month,
              year: data.year,
              productId: data.productId,
              productGoalQty: data.productGoalQty,
            })),
          )
        : [];

    if (created.length === 0) {
      return res.status(400).json({
        message:
          "Nenhuma meta criada — todos os vendedores selecionados já têm meta para este produto no período.",
        skipped,
      });
    }

    return res.status(201).json({
      success: true,
      created: created.length,
      total: data.userIds.length,
      skipped,
      goals: created,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Erro ao criar metas de produto em lote:", error);
    return res.status(500).json({ message: "Erro ao criar metas de produto em lote" });
  }
});

productGoalsRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const success = await storage.deleteProductGoal(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Meta de produto não encontrada" });
    }
    return res.json({ message: "Meta de produto excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta de produto:", error);
    return res.status(500).json({ message: "Erro ao excluir meta de produto" });
  }
});
