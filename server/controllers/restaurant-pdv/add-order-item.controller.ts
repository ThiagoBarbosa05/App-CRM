import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const addItemSchema = z
  .object({
    menuItemId: z.string().optional().nullable(),
    productId: z.string().optional().nullable(),
    name: z.string().min(1, "Nome é obrigatório"),
    unitPrice: z.string().min(1, "Valor é obrigatório"),
    quantity: z.number().int().positive().default(1),
  })
  .refine((data) => !(data.menuItemId && data.productId), {
    message: "Informe apenas menuItemId ou productId, não ambos",
  });

export const addOrderItemController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const parsed = addItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const item = await restaurantPdvService.addItem(orderId, parsed.data);
    return res.status(201).json(item);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENT_REQUESTED") {
      return res.status(409).json({ message: error.message });
    }
    if (
      error?.code === "NO_BLING_CONNECTION" ||
      error?.code === "PRODUCT_NOT_LINKED"
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Erro ao adicionar item à comanda:", error);
    return res.status(500).json({ message: "Erro ao adicionar item à comanda" });
  }
};
