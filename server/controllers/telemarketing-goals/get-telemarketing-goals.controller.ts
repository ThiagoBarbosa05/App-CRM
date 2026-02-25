import { Request, Response } from "express";
import { telemarketingGoalsService } from "../../services/telemarketing-goals.service";

export const getTelemarketingGoalsController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req.query.userId as string) || (req.headers["x-user-id"] as string);
    const userRole = (req.query.userRole as string) || (req.headers["x-user-role"] as string);

    const goals = await telemarketingGoalsService.getGoals(userId, userRole);
    res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de telemarketing:", error);
    res.status(500).json({ message: "Erro ao buscar metas de telemarketing" });
  }
};
