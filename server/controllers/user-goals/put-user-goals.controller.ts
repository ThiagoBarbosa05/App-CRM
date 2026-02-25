import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertUserGoalSchema } from "@shared/schema";
import { storage } from "../../storage";

export async function putUserGoalsController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = insertUserGoalSchema.partial().parse(req.body);
    const goal = await storage.updateUserGoal(id, validatedData);
    return res.json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error, {
        prefix: null,
        includePath: false,
      });
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao atualizar meta:", error);
    return res.status(500).json({ message: "Ocorreu um erro ao processar sua solicitação" });
  }
}
