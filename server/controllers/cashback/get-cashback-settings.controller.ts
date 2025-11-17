import { Request, Response } from "express";
import { getAllCashbackSettings } from "server/db/functions/get-cashback-settings";


export async function getCashbackSettingsController(req: Request, res: Response)  {
  try {
    const settings = await getAllCashbackSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Failed to fetch cashback settings:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar as configurações de cashback." });
  }
}

