import { Request, Response } from "express";
import { updateMessageJobsLog, updateMessageJobsLogSchema } from "../db/functions/update-message-jobs-logs";

export async function updateMessageJobsLogController(req: Request, res: Response) {
  try {
    const dataToValidate = {
      id: req.params.id,
      ...req.body,
    };

    const validationResult = updateMessageJobsLogSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      return res.status(400).json({
        message: "Invalid input data provided.",
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const updatedLog = await updateMessageJobsLog(validationResult.data);

    return res.status(200).json(updatedLog);
  } catch (error) {
    console.error(`[PATCH /api/message-jobs-logs/:id] - Error:`, error);
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes("No fields to update")) {
        return res.status(400).json({ message: error.message });
      }
    }
    return res.status(500).json({ message: "Internal Server Error" });
  }
}