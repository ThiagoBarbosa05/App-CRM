import { Request, Response } from "express";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

export const listCurrentSessionOrdersController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Usuário não autenticado" });
    if (!req.pdvUnitId) {
      return res.status(400).json({ message: "Selecione uma unidade PDV para continuar." });
    }

    const session = await restaurantCashSessionService.getCurrentSession(req.pdvUnitId);
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
