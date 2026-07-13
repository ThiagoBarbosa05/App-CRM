import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const closeOrderSchema = z.object({
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro"]),
});

export const closeOrderController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const parsed = closeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const closed = await restaurantPdvService.closeOrder(orderId, parsed.data.paymentMethod);
    return res.json(closed);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "NO_ITEMS") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao fechar comanda:", error);
    return res.status(500).json({ message: "Erro ao fechar comanda" });
  }
};
