import { Request, Response } from "express";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

/**
 * Acessível ao garçom (`requireGarcomOrGestor`) mesmo ele não operando o
 * caixa: a tela dele precisa saber que está fechado para explicar por que não
 * dá para abrir mesa. Sem isso ele levaria um 403 ao consultar e um 409 ao
 * agir, sem entender nenhum dos dois.
 */
export const getCurrentCashSessionController = async (req: Request, res: Response) => {
  try {
    const session = await restaurantCashSessionService.getCurrentSession();
    if (!session) {
      return res.json({ session: null });
    }

    const detail = await restaurantCashSessionService.getSessionDetail(session.id);
    return res.json({ session: detail });
  } catch (error) {
    console.error("Erro ao buscar o caixa atual:", error);
    return res.status(500).json({ message: "Erro ao buscar o caixa atual" });
  }
};
