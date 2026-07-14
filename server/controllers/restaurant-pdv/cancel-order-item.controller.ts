import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const cancelItemSchema = z.object({
  reason: z.string().min(1, "Motivo é obrigatório"),
});

export const cancelOrderItemController = async (req: Request, res: Response) => {
  try {
    const { id: orderId, itemId } = req.params;
    const parsed = cancelItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    await restaurantPdvService.cancelItem(orderId, itemId, parsed.data.reason, actorId);
    return res.json({ message: "Item cancelado" });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENT_REQUESTED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao cancelar item da comanda:", error);
    return res.status(500).json({ message: "Erro ao cancelar item da comanda" });
  }
};
