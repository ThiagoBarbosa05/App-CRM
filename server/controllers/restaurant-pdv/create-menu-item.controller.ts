import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

const createMenuItemSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.string().min(1, "Preço é obrigatório"),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createMenuItemController = async (req: Request, res: Response) => {
  try {
    const parsed = createMenuItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const createdBy = req.user?.userId;
    if (!createdBy) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const item = await restaurantPdvService.createMenuItem({
      name: parsed.data.name,
      price: parsed.data.price,
      category: parsed.data.category ?? null,
      isActive: parsed.data.isActive ?? true,
      createdBy,
    });
    return res.status(201).json(item);
  } catch (error) {
    console.error("Erro ao criar item do cardápio:", error);
    return res.status(500).json({ message: "Erro ao criar item do cardápio" });
  }
};
