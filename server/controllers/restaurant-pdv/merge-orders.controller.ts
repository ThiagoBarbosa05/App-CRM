import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const mergeOrdersController = async (req: Request, res: Response) => {
  try {
    const { id: sourceOrderId, targetId: targetOrderId } = req.params;

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    await restaurantPdvService.mergeOrders(sourceOrderId, targetOrderId, actorId);
    return res.json({ message: "Mesas mescladas" });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error?.code === "ORDER_CLOSED" ||
      error?.code === "PAYMENT_REQUESTED" ||
      error?.code === "INVALID_TARGET" ||
      error?.code === "PAYMENTS_ALREADY_REGISTERED"
    ) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao juntar mesas:", error);
    return res.status(500).json({ message: "Erro ao juntar mesas" });
  }
};
