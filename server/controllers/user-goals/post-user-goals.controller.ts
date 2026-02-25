import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertUserGoalSchema } from "@shared/schema";
import { storage } from "../../storage";

export async function postUserGoalsController(req: Request, res: Response) {
  try {
    const validatedData = insertUserGoalSchema.parse(req.body);

    // Verificar se já existe uma meta para este usuário no mês/ano especificado
    const existingGoal = await storage.getUserGoalByUserIdMonthYear(
      validatedData.userId,
      validatedData.month,
      validatedData.year
    );

    if (existingGoal) {
      // Se já existe, atualizar a meta existente
      const updatedGoal = await storage.updateUserGoal(
        existingGoal.id,
        validatedData
      );
      return res.json(updatedGoal);
    }

    // Se não existe, criar uma nova meta
    const goal = await storage.createUserGoal(validatedData);
    return res.status(201).json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error, {
        prefix: null,
        includePath: false,
      });
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar meta:", error);
    return res.status(500).json({ message: "Ocorreu um erro ao processar sua solicitação" });
  }
}
