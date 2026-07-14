import { Request, Response } from "express";
import { z } from "zod";
import { restaurantTablesService } from "../../services/restaurant-tables.service";

const createTableSchema = z.object({
  number: z.number().int().positive(),
  capacity: z.number().int().positive().optional(),
  section: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createTableController = async (req: Request, res: Response) => {
  try {
    const parsed = createTableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const createdBy = req.user?.userId;
    if (!createdBy) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const table = await restaurantTablesService.createTable({
      number: parsed.data.number,
      capacity: parsed.data.capacity ?? 4,
      section: parsed.data.section ?? null,
      isActive: parsed.data.isActive ?? true,
      createdBy,
    });
    return res.status(201).json(table);
  } catch (error) {
    console.error("Erro ao criar mesa:", error);
    return res.status(500).json({ message: "Erro ao criar mesa" });
  }
};
