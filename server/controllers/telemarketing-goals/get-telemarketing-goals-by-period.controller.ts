import { Request, Response } from "express";
import { telemarketingGoalsService } from "../../services/telemarketing-goals.service";

export const getTelemarketingGoalsByPeriodController = async (
  req: Request,
  res: Response
) => {
  try {
    const { month, year } = req.params;
    const userId = (req.query.userId as string) || req.user?.userId;
    const userRole = req.user?.role;

    const goals = await telemarketingGoalsService.getGoalsByPeriod(
      Number(month),
      Number(year),
      userId,
      userRole
    );
    res.json(goals);
  } catch (error) {
    console.error("Erro ao buscar metas de telemarketing por período:", error);
    res.status(500).json({ message: "Erro ao buscar metas de telemarketing" });
  }
};
