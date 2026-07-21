import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const listMenuItemsController = async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const items = await restaurantPdvService.listMenuItems(!includeInactive, req.pdvUnitId);
    return res.json(items);
  } catch (error) {
    console.error("Erro ao buscar cardápio:", error);
    return res.status(500).json({ message: "Erro ao buscar cardápio" });
  }
};
