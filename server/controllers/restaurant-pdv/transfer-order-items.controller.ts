import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const transferItemsSchema = z.object({
  itemIds: z.array(z.string()).min(1, "Selecione ao menos um item"),
  targetOrderId: z.string().min(1, "Mesa de destino é obrigatória"),
});

export const transferOrderItemsController = async (req: Request, res: Response) => {
  try {
    const { id: sourceOrderId } = req.params;
    const parsed = transferItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    await restaurantPdvService.transferItems(
      sourceOrderId,
      parsed.data.itemIds,
      parsed.data.targetOrderId,
      actorId,
    );
    return res.json({ message: "Itens transferidos" });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error?.code === "ORDER_CLOSED" ||
      error?.code === "PAYMENT_REQUESTED" ||
      error?.code === "INVALID_TARGET"
    ) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao transferir itens:", error);
    return res.status(500).json({ message: "Erro ao transferir itens" });
  }
};
