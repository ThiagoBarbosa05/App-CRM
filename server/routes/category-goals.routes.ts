import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { bulkCategoryGoalSchema, type GoalPeriod } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";
import {
  goalPeriodParamsSchema,
  isManagerRole,
  validateGoalParams,
} from "./goal-route-validation";

export const categoryGoalsRouter = Router();

categoryGoalsRouter.get(
  "/:month/:year",
  requireAuth,
  validateGoalParams(goalPeriodParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.params as unknown as GoalPeriod;
      const user = req.user!;

      const goals = await storage.getCategoryGoals({ month, year });

      // Vendedor só vê as metas atribuídas a ele; admin/gerente vê tudo.
      const filtered = isManagerRole(user.role)
        ? goals
        : goals.filter((g) => g.userId === user.userId);

      return res.json(filtered);
    } catch (error) {
      console.error("Erro ao buscar metas de categoria:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de categoria" });
    }
  },
);

categoryGoalsRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const schema = z.object({
      userId: z.string().min(1, "Vendedor obrigatório"),
      categoryName: z.string().min(1, "Categoria obrigatória"),
      goalQty: z.coerce.number().int().min(1, "Mínimo 1 unidade"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    });
    const data = schema.parse(req.body);
    const goal = await storage.createCategoryGoal(data);
    return res.status(201).json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Erro ao criar meta de categoria:", error);
    return res.status(500).json({ message: "Erro ao criar meta de categoria" });
  }
});

categoryGoalsRouter.post("/bulk", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const data = bulkCategoryGoalSchema.parse(req.body);

    // Evita duplicar (userId, categoryName) já existente no período.
    const existing = await storage.getCategoryGoals({
      month: Number(data.startDate.slice(5, 7)),
      year: Number(data.startDate.slice(0, 4)),
    });
    const alreadyGoaled = new Set(
      existing
        .filter((g) => g.categoryName === data.categoryName)
        .map((g) => g.userId),
    );

    const toCreate = data.userIds.filter((id) => !alreadyGoaled.has(id));
    const skipped = data.userIds.filter((id) => alreadyGoaled.has(id));

    const created =
      toCreate.length > 0
        ? await storage.createCategoryGoalsBulk(
            toCreate.map((userId) => ({
              userId,
              categoryName: data.categoryName,
              goalQty: data.goalQty,
              startDate: data.startDate,
              endDate: data.endDate,
            })),
          )
        : [];

    if (created.length === 0) {
      return res.status(400).json({
        message:
          "Nenhuma meta criada — todos os vendedores selecionados já têm meta para esta categoria no período.",
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
    console.error("Erro ao criar metas de categoria em lote:", error);
    return res.status(500).json({ message: "Erro ao criar metas de categoria em lote" });
  }
});

categoryGoalsRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const success = await storage.deleteCategoryGoal(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Meta de categoria não encontrada" });
    }
    return res.json({ message: "Meta de categoria excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta de categoria:", error);
    return res.status(500).json({ message: "Erro ao excluir meta de categoria" });
  }
});
