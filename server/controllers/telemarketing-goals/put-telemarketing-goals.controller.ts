import { Request, Response } from "express";
import { telemarketingGoalsService } from "../../services/telemarketing-goals.service";
import { insertTelemarketingGoalSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const putTelemarketingGoalController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const validatedData = insertTelemarketingGoalSchema
      .partial()
      .parse(req.body);
    const goal = await telemarketingGoalsService.updateGoal(id, validatedData);
    res.json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao atualizar meta de telemarketing:", error);
    res.status(500).json({ message: "Erro ao atualizar meta de telemarketing" });
  }
};
