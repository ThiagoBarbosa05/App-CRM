import { Request, Response } from "express";
import { restaurantTablesService } from "../../services/restaurant-tables.service";

export const deactivateTableController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await restaurantTablesService.deactivateTable(id);
    return res.json({ message: "Mesa desativada" });
  } catch (error: any) {
    if (error?.code === "TABLE_HAS_OPEN_ORDER") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao desativar mesa:", error);
    return res.status(500).json({ message: "Erro ao desativar mesa" });
  }
};
