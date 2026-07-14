import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const removeDiscountController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const order = await restaurantPdvService.removeDiscount(orderId, actorId);
    return res.json(order);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENT_REQUESTED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao remover desconto:", error);
    return res.status(500).json({ message: "Erro ao remover desconto" });
  }
};
