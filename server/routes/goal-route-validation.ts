import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export const goalIdParamsSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
});

export const goalPeriodParamsSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
});

export function validateGoalBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }

      next(error);
    }
  };
}

export function validateGoalParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }

      next(error);
    }
  };
}
