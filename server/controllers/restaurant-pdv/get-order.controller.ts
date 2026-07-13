import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const getOrderController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await restaurantPdvService.getOrderWithItems(id);
    if (!order) {
      return res.status(404).json({ message: "Comanda não encontrada" });
    }
    return res.json(order);
  } catch (error) {
    console.error("Erro ao buscar comanda:", error);
    return res.status(500).json({ message: "Erro ao buscar comanda" });
  }
};
