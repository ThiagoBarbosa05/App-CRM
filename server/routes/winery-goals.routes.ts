import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { GoalPeriod } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";
import {
  goalPeriodParamsSchema,
  isManagerRole,
  validateGoalParams,
} from "./goal-route-validation";

export const wineryGoalsRouter = Router();

wineryGoalsRouter.get(
  "/:month/:year",
  requireAuth,
  validateGoalParams(goalPeriodParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { month, year } = req.params as unknown as GoalPeriod;
      const user = req.user!;

      const goals = await storage.getWineryGoals({ month, year });

      // Vendedor só vê as metas atribuídas a ele; admin/gerente vê tudo.
      const filtered = isManagerRole(user.role)
        ? goals
        : goals.filter((g) => g.userId === user.userId);

      return res.json(filtered);
    } catch (error) {
      console.error("Erro ao buscar metas de vinícola:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de vinícola" });
    }
  },
);

wineryGoalsRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const schema = z.object({
      userId: z.string().min(1, "Vendedor obrigatório"),
      wineryName: z.string().min(1, "Vinícola obrigatória"),
      goalQty: z.coerce.number().int().min(1, "Mínimo 1 unidade"),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    });
    const data = schema.parse(req.body);
    const goal = await storage.createWineryGoal(data);
    return res.status(201).json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Erro ao criar meta de vinícola:", error);
    return res.status(500).json({ message: "Erro ao criar meta de vinícola" });
  }
});

wineryGoalsRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isManagerRole(req.user!.role)) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const success = await storage.deleteWineryGoal(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Meta de vinícola não encontrada" });
    }
    return res.json({ message: "Meta de vinícola excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta de vinícola:", error);
    return res.status(500).json({ message: "Erro ao excluir meta de vinícola" });
  }
});
