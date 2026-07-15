import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

export const categoryGoalsRouter = Router();

categoryGoalsRouter.get("/", async (req, res) => {
  try {
    const goals = await storage.getCategoryGoals();
    return res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de categoria:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de categoria" });
  }
});

categoryGoalsRouter.post("/", async (req, res) => {
  try {
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

categoryGoalsRouter.delete("/:id", async (req, res) => {
  try {
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
