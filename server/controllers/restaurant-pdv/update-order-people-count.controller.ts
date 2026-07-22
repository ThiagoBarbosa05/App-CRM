import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { restaurantOrders } from "@shared/schema";
import { eq } from "drizzle-orm";

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

    const [updated] = await db
      .update(restaurantOrders)
      .set({ peopleCount: parsed.data.peopleCount })
      .where(eq(restaurantOrders.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Comanda não encontrada" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar número de pessoas:", err);
    return res.status(500).json({ message: "Erro ao atualizar número de pessoas" });
  }
};
