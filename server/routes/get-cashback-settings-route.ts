import { Router } from "express";
import { getAllCashbackSettings } from "server/db/functions/get-cashback-settings";

const router = Router();

router.get("/cashback-settings", async (req, res) => {
  try {
    const settings = await getAllCashbackSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Failed to fetch cashback settings:", error);
    res
      .status(500)
      .json({ message: "Erro ao buscar as configurações de cashback." });
  }
});

export const getCashbackSettingsRoute = router;
