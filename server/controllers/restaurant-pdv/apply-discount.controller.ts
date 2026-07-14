import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const applyDiscountSchema = z
  .object({
    discountPercent: z.string().min(1).optional(),
    discountAmount: z.string().min(1).optional(),
    reason: z.string().min(1, "Motivo é obrigatório"),
  })
  .refine(
    (data) => !!data.discountPercent !== !!data.discountAmount,
    { message: "Informe percentual OU valor fixo de desconto, não os dois" },
  );

export const applyDiscountController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const parsed = applyDiscountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const order = await restaurantPdvService.applyDiscount(orderId, parsed.data, actorId);
    return res.json(order);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENT_REQUESTED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao aplicar desconto:", error);
    return res.status(500).json({ message: "Erro ao aplicar desconto" });
  }
};
