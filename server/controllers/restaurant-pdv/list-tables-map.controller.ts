import { Request, Response } from "express";
import { restaurantTablesService } from "../../services/restaurant-tables.service";

export const listTablesMapController = async (req: Request, res: Response) => {
  try {
    const tables = await restaurantTablesService.listTablesWithStatus();
    return res.json(tables);
  } catch (error) {
    console.error("Erro ao buscar mapa de mesas:", error);
    return res.status(500).json({ message: "Erro ao buscar mapa de mesas" });
  }
};
