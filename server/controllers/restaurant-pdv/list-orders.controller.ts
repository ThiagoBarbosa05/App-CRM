import { Request, Response } from "express";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

export const listOrdersController = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as "aberta" | "fechada" | undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const orders = await restaurantPdvService.listOrders({ status, from, to });
    return res.json(orders);
  } catch (error) {
    console.error("Erro ao buscar histórico de comandas:", error);
    return res.status(500).json({ message: "Erro ao buscar histórico de comandas" });
  }
};
