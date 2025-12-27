import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertWeeklyResultSchema } from "@shared/schema";
import { storage } from "../../storage";

export async function postWeeklyResultsController(req: Request, res: Response) {
  try {
    const validatedData = insertWeeklyResultSchema.parse(req.body);

    // Verificar se já existe resultado para essa meta e semana
    const existingResult = await storage.getWeeklyResult(
      validatedData.goalId,
      validatedData.week
    );

    if (existingResult) {
      // Se existe, atualizar
      const updatedResult = await storage.updateWeeklyResult(
        existingResult.id,
        validatedData
      );
      return res.json(updatedResult);
    }

    // Se não existe, criar novo
    const result = await storage.createWeeklyResult(validatedData);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao salvar resultado semanal:", error);
    return res
      .status(500)
      .json({ message: "Erro ao salvar resultado semanal" });
  }
}
