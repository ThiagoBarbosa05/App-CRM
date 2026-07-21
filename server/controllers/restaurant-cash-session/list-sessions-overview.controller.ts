import { Request, Response } from "express";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

export const listSessionsOverviewController = async (req: Request, res: Response) => {
  try {
    // Sem filtro de unidade: exibe sessões de TODAS as unidades para o gestor
    const sessions = await restaurantCashSessionService.listSessionsOverview();
    return res.json(sessions);
  } catch (error) {
    console.error("Erro ao buscar visão geral dos caixas:", error);
    return res.status(500).json({ message: "Erro ao buscar visão geral dos caixas" });
  }
};
