import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const schema = z.object({
  peopleCount: z.number().int().min(1).max(100),
});

export const updateOrderPeopleCountController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const updated = await restaurantPdvService.updateOrderPeopleCount(
      id,
      parsed.data.peopleCount,
      actorId,
      req.pdvUnitId,
    );
    return res.json(updated);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND" || error?.code === "FORBIDDEN") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao atualizar número de pessoas:", error);
    return res.status(500).json({ message: "Erro ao atualizar número de pessoas" });
  }
};
