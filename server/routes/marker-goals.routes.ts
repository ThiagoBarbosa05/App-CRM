import { Router } from "express";

import { storage } from "../storage";
import { insertMarkerGoalSchema } from "@shared/schema";
import { goalIdParamsSchema, goalPeriodParamsSchema, validateGoalBody, validateGoalParams } from "./goal-route-validation";

export const markerGoalsRouter = Router();
export const markerStatsRouter = Router();

markerGoalsRouter.get("/", async (req, res) => {
  try {
    const { userId, userRole } = req.query;
    const goals = await storage.getMarkerGoals(userId as string, userRole as string);
    return res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de marcadores:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de marcadores" });
  }
});

markerGoalsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const { userId, userRole } = req.query;
      const goals = await storage.getMarkerGoalsByMonthYear(
        Number(month),
        Number(year),
        userId as string,
        userRole as string,
      );
      return res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de marcadores:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de marcadores" });
    }
  },
);

markerGoalsRouter.post(
  "/",
  validateGoalBody(insertMarkerGoalSchema),
  async (req, res) => {
    try {
      const goal = await storage.createMarkerGoal(req.body);
      return res.status(201).json(goal);
    } catch (error) {
      console.error("Erro ao criar meta de marcadores:", error);
      return res.status(500).json({ message: "Erro ao criar meta de marcadores" });
    }
  },
);

markerGoalsRouter.put(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertMarkerGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateMarkerGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de marcadores:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de marcadores" });
    }
  },
);

markerGoalsRouter.patch(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertMarkerGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateMarkerGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de marcadores:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de marcadores" });
    }
  },
);

markerGoalsRouter.delete(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  async (req, res) => {
    try {
      const success = await storage.deleteMarkerGoal(req.params.id);
      if (success === false) {
        return res.status(404).json({ message: "Meta de marcadores não encontrada" });
      }

      return res.json({ message: "Meta de marcadores excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de marcadores:", error);
      return res.status(500).json({ message: "Erro ao excluir meta de marcadores" });
    }
  },
);

markerStatsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getMarkerStatsByPeriod(Number(month), Number(year));
      return res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de marcadores:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas de marcadores" });
    }
  },
);

export default markerGoalsRouter;
