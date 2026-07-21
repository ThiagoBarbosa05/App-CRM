import { Request, Response } from "express";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

export const listCashSessionsController = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const sessions = await restaurantCashSessionService.listSessions(limit);
    return res.json(sessions);
  } catch (error) {
    console.error("Erro ao listar caixas:", error);
    return res.status(500).json({ message: "Erro ao listar caixas" });
  }
};

export const getCashSessionController = async (req: Request, res: Response) => {
  try {
    const detail = await restaurantCashSessionService.getSessionDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ message: "Caixa não encontrado" });
    }
    return res.json(detail);
  } catch (error) {
    console.error("Erro ao buscar o caixa:", error);
    return res.status(500).json({ message: "Erro ao buscar o caixa" });
  }
};
