import { Router } from "express";

import { storage } from "../storage";
import { goalIdParamsSchema, goalPeriodParamsSchema, validateGoalBody, validateGoalParams } from "./goal-route-validation";
import { insertClientRegistrationGoalSchema } from "@shared/schema";

export const clientRegistrationGoalsRouter = Router();
export const clientRegistrationStatsRouter = Router();

clientRegistrationGoalsRouter.get("/", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || req.user?.userId;
    const userRole = req.user?.role;
    const goals = await storage.getClientRegistrationGoals(userId, userRole);
    return res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de cadastros:", error);
    return res.status(500).json({ message: "Erro ao buscar metas de cadastros" });
  }
});

clientRegistrationGoalsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const userId = (req.query.userId as string) || req.user?.userId;
      const userRole = req.user?.role;

      const goals = await storage.getClientRegistrationGoalsByMonthYear(
        Number(month),
        Number(year),
        userId,
        userRole,
      );
      return res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de cadastros:", error);
      return res.status(500).json({ message: "Erro ao buscar metas de cadastros" });
    }
  },
);

clientRegistrationGoalsRouter.post(
  "/",
  validateGoalBody(insertClientRegistrationGoalSchema),
  async (req, res) => {
    try {
      const goal = await storage.createClientRegistrationGoal(req.body);
      return res.status(201).json(goal);
    } catch (error) {
      console.error("Erro ao criar meta de cadastros:", error);
      return res.status(500).json({ message: "Erro ao criar meta de cadastros" });
    }
  },
);

clientRegistrationGoalsRouter.put(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertClientRegistrationGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateClientRegistrationGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de cadastros:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de cadastros" });
    }
  },
);

clientRegistrationGoalsRouter.patch(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  validateGoalBody(insertClientRegistrationGoalSchema.partial()),
  async (req, res) => {
    try {
      const goal = await storage.updateClientRegistrationGoal(req.params.id, req.body);
      return res.json(goal);
    } catch (error) {
      console.error("Erro ao atualizar meta de cadastros:", error);
      return res.status(500).json({ message: "Erro ao atualizar meta de cadastros" });
    }
  },
);

clientRegistrationGoalsRouter.delete(
  "/:id",
  validateGoalParams(goalIdParamsSchema),
  async (req, res) => {
    try {
      const success = await storage.deleteClientRegistrationGoal(req.params.id);
      if (success === false) {
        return res.status(404).json({ message: "Meta de cadastros não encontrada" });
      }

      return res.json({ message: "Meta de cadastros excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de cadastros:", error);
      return res.status(500).json({ message: "Erro ao excluir meta de cadastros" });
    }
  },
);

clientRegistrationStatsRouter.get(
  "/:month/:year",
  validateGoalParams(goalPeriodParamsSchema),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getClientRegistrationStatsByPeriod(
        Number(month),
        Number(year),
      );
      return res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de cadastros:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas de cadastros" });
    }
  },
);

export default clientRegistrationGoalsRouter;
