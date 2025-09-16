import { Request, Response } from "express";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";

export async function getMessageAutomationSettingsController(req: Request, res: Response) {
  try {
    const settings = await getAllMessageAutomationSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Failed to fetch message automation settings:", error);
    res.status(500).json({ message: "Error fetching message automation settings." });
  }
}