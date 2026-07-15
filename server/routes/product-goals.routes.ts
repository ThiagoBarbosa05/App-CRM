import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

export const productGoalsRouter = Router();

productGoalsRouter.get("/:month/:year", async (req, res) => {
  try {
    const month = Number(req.params.month);
    const year = Number(req.params.year);
    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ message: "Mês e ano inválidos" });
    }
    const goals = await storage.getProductGoalsByPeriod(month, year);
    return res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de produto:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de produto" });
  }
});

productGoalsRouter.post("/", async (req, res) => {
  try {
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

productGoalsRouter.delete("/:id", async (req, res) => {
  try {
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
