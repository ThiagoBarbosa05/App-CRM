import { Request, Response } from "express";
import { restaurantTablesService } from "../../services/restaurant-tables.service";

export const listTablesController = async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const tables = await restaurantTablesService.listTables(includeInactive, req.pdvUnitId);
    return res.json(tables);
  } catch (error) {
    console.error("Erro ao buscar mesas:", error);
    return res.status(500).json({ message: "Erro ao buscar mesas" });
  }
};
