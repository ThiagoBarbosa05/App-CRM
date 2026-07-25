import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const schema = z.object({
  clientId: z.string().nullable(),
  clientName: z.string().nullable(),
});

export const updateOrderClientController = async (req: Request, res: Response) => {
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

    const updated = await restaurantPdvService.updateOrderClient(
      id,
      parsed.data,
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
    console.error("Erro ao atualizar cliente da comanda:", error);
    return res.status(500).json({ message: "Erro ao atualizar cliente" });
  }
};
