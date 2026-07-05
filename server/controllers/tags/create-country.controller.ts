import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

export const createCountryController = async (req: Request, res: Response) => {
  try {
    const countryData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "pais",
    };

    const validatedData = insertTagSchema.parse(countryData);
    const country = await storage.createTag(validatedData);
    res.status(201).json(country);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar país" });
  }
};
