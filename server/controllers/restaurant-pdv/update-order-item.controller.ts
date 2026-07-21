import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const updateItemSchema = z.object({
  unitPrice: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
});

export const updateOrderItemController = async (req: Request, res: Response) => {
  try {
    const { id: orderId, itemId } = req.params;
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    // Alterar preço equivale a conceder desconto: mesma restrição do fluxo de
    // desconto (gestor). Quantidade continua liberada para o garçom.
    if (parsed.data.unitPrice !== undefined && !["admin", "gerente"].includes(req.user?.role ?? "")) {
      return res.status(403).json({
        message: "Apenas administradores e gerentes podem alterar o preço de um item",
      });
    }

    const updated = await restaurantPdvService.updateItem(
      orderId,
      itemId,
      parsed.data,
      actorId,
    );
    if (!updated) {
      return res.status(404).json({ message: "Item não encontrado" });
    }
    return res.json(updated);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENT_REQUESTED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao atualizar item da comanda:", error);
    return res.status(500).json({ message: "Erro ao atualizar item da comanda" });
  }
};
