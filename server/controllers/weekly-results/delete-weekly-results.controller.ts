import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function deleteWeeklyResultsController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    const success = await storage.deleteWeeklyResult(id);

    if (success === false) {
      return res
        .status(404)
        .json({ message: "Resultado semanal não encontrado" });
    }

    res.json({ message: "Resultado semanal excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir resultado semanal:", error);
    res.status(500).json({ message: "Erro ao excluir resultado semanal" });
  }
}
