import { Request, Response } from "express";
import { z } from "zod";
import { restaurantCashSessionService } from "../../services/restaurant-cash-session.service";

const movementSchema = z.object({
  type: z.enum(["sangria", "suprimento"]),
  amount: z.string().min(1, "Informe o valor"),
  // Motivo é obrigatório: movimento de dinheiro sem justificativa é
  // exatamente o que a auditoria precisa impedir.
  reason: z.string().trim().min(3, "Descreva o motivo do movimento"),
});

export const addCashMovementController = async (req: Request, res: Response) => {
  try {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const movement = await restaurantCashSessionService.addMovement(parsed.data, actorId);
    return res.status(201).json(movement);
  } catch (error: any) {
    if (error?.code === "NO_CASH_SESSION") {
      return res.status(409).json({ message: error.message });
    }
    if (error?.code === "INVALID_AMOUNT" || error?.code === "INSUFFICIENT_CASH") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Erro ao registrar movimento de caixa:", error);
    return res.status(500).json({ message: "Erro ao registrar movimento de caixa" });
  }
};
