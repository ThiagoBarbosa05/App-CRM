import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function getWeeklyResultsByGoalIdController(
  req: Request,
  res: Response
) {
  try {
    const { goalId } = req.params;
    const results = await storage.getWeeklyResultsByGoalId(goalId);
    return res.json(results);
  } catch (error) {
    console.error("Erro ao buscar resultados semanais:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar resultados semanais" });
  }
}
