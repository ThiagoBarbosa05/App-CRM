import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function deleteUserGoalsController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const success = await storage.deleteUserGoal(id);
    if (success === false) {
      return res.status(404).json({ message: "Meta não encontrada" });
    }
    return res.json({ message: "Meta excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta:", error);
    return res.status(500).json({ message: "Erro ao excluir meta" });
  }
}
