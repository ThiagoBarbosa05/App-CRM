import { Router } from "express";

import { storage } from "../storage";
import { insertInteractionGoalSchema } from "@shared/schema";
import { goalIdParamsSchema, goalPeriodParamsSchema, validateGoalBody, validateGoalParams } from "./goal-route-validation";

export const interactionGoalsRouter = Router();
export const interactionStatsRouter = Router();

interactionGoalsRouter.get("/", async (req, res) => {
  try {
    const { userId, userRole } = req.query;
    const goals = await storage.getInteractionGoals(userId as string, userRole as string);
    return res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de interações:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de interações" });
  }
});

interactionGoalsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const { userId, userRole } = req.query;
      const goals = await storage.getInteractionGoalsByMonthYear(
        Number(month),
        Number(year),
        userId as string,
        userRole as string,
      );
      return res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de interações:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de interações" });
    }
  },
);

interactionGoalsRouter.post(
  "/",
  validateGoalBody(insertInteractionGoalSchema),
  async (req, res) => {
    try {
      const goal = await storage.createInteractionGoal(req.body);
      return res.status(201).json(goal);
    } catch (error) {
      console.error("Erro ao criar meta de interações:", error);
      return res.status(500).json({ message: "Erro ao criar meta de interações" });
    }
  },
);

interactionGoalsRouter.put(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertInteractionGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateInteractionGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de interações:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de interações" });
    }
  },
);

interactionGoalsRouter.patch(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertInteractionGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateInteractionGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de interações:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de interações" });
    }
  },
);

interactionGoalsRouter.delete(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  async (req, res) => {
    try {
      const success = await storage.deleteInteractionGoal(req.params.id);
      if (success === false) {
        return res.status(404).json({ message: "Meta de interações não encontrada" });
      }

      return res.json({ message: "Meta de interações excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de interações:", error);
      return res.status(500).json({ message: "Erro ao excluir meta de interações" });
    }
  },
);

interactionStatsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getInteractionStatsByPeriod(Number(month), Number(year));
      return res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de interações:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas de interações" });
    }
  },
);

export default interactionGoalsRouter;
