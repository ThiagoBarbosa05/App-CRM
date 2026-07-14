import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";
import { restaurantOrderPaymentsService } from "../../services/restaurant-order-payments.service";

export const removeOrderPaymentController = async (req: Request, res: Response) => {
  try {
    const { id: orderId, paymentId } = req.params;
    await restaurantPdvService.assertOrderOpen(orderId);
    await restaurantOrderPaymentsService.removePayment(orderId, paymentId);
    return res.json({ message: "Pagamento removido" });
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao remover pagamento:", error);
    return res.status(500).json({ message: "Erro ao remover pagamento" });
  }
};
