import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const openOrderSchema = z.object({
  tableId: z.string().min(1).optional().nullable(),
  tableNumber: z.number().int().positive().optional(),
  peopleCount: z.number().int().positive(),
});

export const openOrderController = async (req: Request, res: Response) => {
  try {
    const parsed = openOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { tableId, tableNumber, peopleCount } = parsed.data;

    if (!tableId && !tableNumber) {
      return res.status(400).json({ message: "Informe a mesa (tableId ou tableNumber)" });
    }

    const waiterId = req.user?.userId;
    if (!waiterId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const order = await restaurantPdvService.openOrder({
      tableId: tableId ?? null,
      tableNumber: tableNumber,
      peopleCount,
      waiterId,
    });
    return res.status(201).json(order);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "TABLE_OCCUPIED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao abrir comanda:", error);
    return res.status(500).json({ message: "Erro ao abrir comanda" });
  }
};
