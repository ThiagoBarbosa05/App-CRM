import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const removeOrderItemController = async (req: Request, res: Response) => {
  try {
    const { id: orderId, itemId } = req.params;
    await restaurantPdvService.removeItem(orderId, itemId);
    return res.json({ message: "Item removido" });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao remover item da comanda:", error);
    return res.status(500).json({ message: "Erro ao remover item da comanda" });
  }
};
