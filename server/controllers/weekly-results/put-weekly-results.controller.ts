import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertWeeklyResultSchema } from "@shared/schema";
import { storage } from "../../storage";

export async function putWeeklyResultsController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = insertWeeklyResultSchema.partial().parse(req.body);
    const result = await storage.updateWeeklyResult(id, validatedData);
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao atualizar resultado semanal:", error);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar resultado semanal" });
  }
}
