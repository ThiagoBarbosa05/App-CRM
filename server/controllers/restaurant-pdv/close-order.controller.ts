import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const closeOrderSchema = z.object({
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro"]).optional(),
  // Divisão de conta: os pagamentos vêm junto para serem gravados na mesma
  // transação do fechamento.
  payments: z
    .array(
      z.object({
        method: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro"]),
        amount: z.string().min(1, "Valor é obrigatório"),
        payerLabel: z.string().optional(),
      }),
    )
    .optional(),
});

export const closeOrderController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const parsed = closeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const closed = await restaurantPdvService.closeOrder(
      orderId,
      parsed.data.paymentMethod,
      actorId,
      parsed.data.payments,
    );
    return res.json(closed);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error?.code === "ORDER_CLOSED" ||
      error?.code === "NO_CASH_SESSION" ||
      error?.code === "NO_ITEMS" ||
      error?.code === "NO_PAYMENT_METHOD" ||
      error?.code === "PAYMENTS_MISMATCH"
    ) {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao fechar comanda:", error);
    return res.status(500).json({ message: "Erro ao fechar comanda" });
  }
};
