import { Request, Response } from "express";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

export const listCurrentSessionOrdersController = async (req: Request, res: Response) => {
  try {
    const session = await restaurantCashSessionService.getCurrentSession();
    if (!session) {
      return res.json({ orders: [] });
    }

    const orders = await restaurantCashSessionService.listSessionOrders(session.id, 50);
    return res.json({ orders });
  } catch (error) {
    console.error("Erro ao buscar comandas da sessão atual:", error);
    return res.status(500).json({ message: "Erro ao buscar comandas da sessão atual" });
  }
};
