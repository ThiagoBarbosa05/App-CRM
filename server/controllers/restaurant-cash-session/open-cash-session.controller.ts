import { Request, Response } from "express";
import { z } from "zod";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

const openSessionSchema = z.object({
  openingFloat: z.string().min(1, "Informe o fundo de troco"),
});

export const openCashSessionController = async (req: Request, res: Response) => {
  try {
    const parsed = openSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const session = await restaurantCashSessionService.openSession(
      parsed.data.openingFloat,
      actorId,
      req.pdvUnitId,
    );
    return res.status(201).json(session);
  } catch (error: any) {
    if (error?.code === "SESSION_ALREADY_OPEN") {
      return res.status(409).json({ message: error.message });
    }
    if (error?.code === "INVALID_AMOUNT") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Erro ao abrir o caixa:", error);
    return res.status(500).json({ message: "Erro ao abrir o caixa" });
  }
};
