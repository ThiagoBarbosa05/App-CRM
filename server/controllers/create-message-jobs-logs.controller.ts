import { Request, Response } from "express";
import { createMessageJobsLog, insertMessageJobsLogSchema } from "../db/functions/create-message-jobs-logs";
import { ZodError } from "zod";

export async function createMessageJobsLogController(req: Request, res: Response) {
  try {
    const validationResult = insertMessageJobsLogSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({ errors: validationResult.error.flatten() });
    }

    const validatedData = validationResult.data;
    const newLog = await createMessageJobsLog(validatedData);

    return res.status(201).json(newLog);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    console.error("Error creating message jobs log:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}