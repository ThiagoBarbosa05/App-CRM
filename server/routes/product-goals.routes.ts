import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware/validation";

export const productGoalsRouter = Router();

const MANAGER_ROLES = new Set(["admin", "administrador", "gerente"]);

productGoalsRouter.get("/:month/:year", requireAuth, async (req: Request, res: Response) => {
  try {
    const month = Number(req.params.month);
    const year = Number(req.params.year);
    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ message: "Mês e ano inválidos" });
    }

    const user = req.user!;
    const isManager = MANAGER_ROLES.has(user.role ?? "");

    const goals = await storage.getProductGoalsByPeriod(month, year);

    // Vendedor só vê as metas atribuídas a ele; admin/gerente vê tudo.
    const filtered = isManager
      ? goals
      : goals.filter((g: any) => g.userId === user.userId);

    return res.json(filtered);
  } catch (error) {
    console.error("Erro ao buscar metas de produto:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de produto" });
  }
});

productGoalsRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (!MANAGER_ROLES.has(user.role ?? "")) {
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

productGoalsRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (!MANAGER_ROLES.has(user.role ?? "")) {
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
