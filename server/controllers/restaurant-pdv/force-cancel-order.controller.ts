import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const forceCancelOrderController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    await restaurantPdvService.forceCancelOrder(id, actorId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENTS_ALREADY_REGISTERED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao excluir mesa:", error);
    return res.status(500).json({ message: "Erro ao excluir mesa" });
  }
};
