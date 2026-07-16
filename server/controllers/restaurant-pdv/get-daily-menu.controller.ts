import { Request, Response } from "express";
import { restaurantDailyMenuService } from "../../services/restaurant-daily-menu.service";

export const getDailyMenuController = async (req: Request, res: Response) => {
  try {
    const date =
      typeof req.query.date === "string" ? req.query.date : undefined;
    const items = await restaurantDailyMenuService.getDailyMenu(date);
    return res.json(items);
  } catch (error) {
    console.error("Erro ao buscar cardápio do dia:", error);
    return res.status(500).json({ message: "Erro ao buscar cardápio do dia" });
  }
};
