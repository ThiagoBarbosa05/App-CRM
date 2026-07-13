import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.string().min(1).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateMenuItemController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateMenuItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const updated = await restaurantPdvService.updateMenuItem(id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Item do cardápio não encontrado" });
    }
    return res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar item do cardápio:", error);
    return res.status(500).json({ message: "Erro ao atualizar item do cardápio" });
  }
};
