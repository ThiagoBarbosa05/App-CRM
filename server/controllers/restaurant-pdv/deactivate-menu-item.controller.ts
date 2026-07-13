import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const deactivateMenuItemController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await restaurantPdvService.deactivateMenuItem(id);
    return res.json({ message: "Item do cardápio desativado" });
  } catch (error) {
    console.error("Erro ao desativar item do cardápio:", error);
    return res.status(500).json({ message: "Erro ao desativar item do cardápio" });
  }
};
