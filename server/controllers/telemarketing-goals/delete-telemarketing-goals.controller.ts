import { Request, Response } from "express";
import { telemarketingGoalsService } from "../../services/telemarketing-goals.service";

export const deleteTelemarketingGoalController = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const success = await telemarketingGoalsService.deleteGoal(id);
    if (success === false) {
      return res
        .status(404)
        .json({ message: "Meta de telemarketing não encontrada" });
    }
    res.json({ message: "Meta de telemarketing excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir meta de telemarketing:", error);
    res.status(500).json({ message: "Erro ao excluir meta de telemarketing" });
  }
};
