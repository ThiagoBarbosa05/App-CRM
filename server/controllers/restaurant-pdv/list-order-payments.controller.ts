import { Request, Response } from "express";
import { restaurantOrderPaymentsService } from "../../services/restaurant-order-payments.service";

export const listOrderPaymentsController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const payments = await restaurantOrderPaymentsService.listPayments(orderId);
    return res.json(payments);
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    return res.status(500).json({ message: "Erro ao buscar pagamentos" });
  }
};
