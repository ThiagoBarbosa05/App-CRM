import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";
import { restaurantOrderPaymentsService } from "../../services/restaurant-order-payments.service";
import { positiveMoneyString } from "./money.schema";

const addPaymentSchema = z.object({
  method: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro"]),
  amount: positiveMoneyString,
  payerLabel: z.string().optional(),
});

export const addOrderPaymentController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const parsed = addPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    await restaurantPdvService.assertOrderOpen(orderId, req.pdvUnitId);
    const payment = await restaurantOrderPaymentsService.addPayment(orderId, parsed.data);
    return res.status(201).json(payment);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND" || error?.code === "FORBIDDEN") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "INVALID_AMOUNT") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao registrar pagamento:", error);
    return res.status(500).json({ message: "Erro ao registrar pagamento" });
  }
};
