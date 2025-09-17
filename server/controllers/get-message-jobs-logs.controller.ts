import { Request, Response } from "express";
import { getMessageJobsLogs, GetMessageJobsLogsInput } from "../db/functions/get-message-jobs-logs";

export async function getMessageJobsLogsController(req: Request, res: Response) {
  try {
    const validationResult = GetMessageJobsLogsInput.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({ errors: validationResult.error.flatten() });
    }

    const result = await getMessageJobsLogs(validationResult.data);
    res.status(200).json(result);
  } catch (error) {
    console.error("Failed to fetch message jobs logs:", error);
    res.status(500).json({ message: "Error fetching message jobs logs." });
  }
}