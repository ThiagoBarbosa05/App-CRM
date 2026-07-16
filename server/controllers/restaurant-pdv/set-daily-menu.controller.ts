import { Request, Response } from "express";
import { z } from "zod";
import { restaurantDailyMenuService } from "../../services/restaurant-daily-menu.service";

const setDailyMenuSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)"),
  menuItemIds: z.array(z.string()),
});

export const setDailyMenuController = async (req: Request, res: Response) => {
  try {
    const parsed = setDailyMenuSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    await restaurantDailyMenuService.setDailyMenu(
      parsed.data.date,
      parsed.data.menuItemIds,
      actorId,
    );
    const items = await restaurantDailyMenuService.getDailyMenu(parsed.data.date);
    return res.json(items);
  } catch (error) {
    console.error("Erro ao salvar cardápio do dia:", error);
    return res.status(500).json({ message: "Erro ao salvar cardápio do dia" });
  }
};
