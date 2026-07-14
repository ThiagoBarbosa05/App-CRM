import { Request, Response } from "express";
import { z } from "zod";
import { restaurantTablesService } from "../../services/restaurant-tables.service";

const updateTableSchema = z.object({
  number: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  section: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateTableController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = updateTableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const updated = await restaurantTablesService.updateTable(id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Mesa não encontrada" });
    }
    return res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar mesa:", error);
    return res.status(500).json({ message: "Erro ao atualizar mesa" });
  }
};
