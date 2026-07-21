import { Request, Response } from "express";
import { z } from "zod";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

const closeSessionSchema = z.object({
  countedCash: z.string().min(1, "Informe o valor contado na gaveta"),
  countedByMethod: z.record(z.string()).optional(),
  notes: z.string().optional(),
});

export const closeCashSessionController = async (req: Request, res: Response) => {
  try {
    const { id: sessionId } = req.params;
    const parsed = closeSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const session = await restaurantCashSessionService.closeSession(
      sessionId,
      parsed.data,
      actorId,
    );
    return res.json(session);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "SESSION_CLOSED" || error?.code === "OPEN_ORDERS") {
      return res.status(409).json({ message: error.message });
    }
    if (error?.code === "INVALID_AMOUNT") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Erro ao fechar o caixa:", error);
    return res.status(500).json({ message: "Erro ao fechar o caixa" });
  }
};
