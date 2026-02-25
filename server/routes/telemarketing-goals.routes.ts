import { Router } from "express";
import {
  getTelemarketingGoalsController,
  getTelemarketingGoalsByPeriodController,
} from "../controllers/telemarketing-goals/index";

export const telemarketingGoalsRouter = Router();

/**
 * @route GET /api/telemarketing-goals
 * @description List all telemarketing goals with role-based filtering
 */
telemarketingGoalsRouter.get("/", getTelemarketingGoalsController);

/**
 * @route GET /api/telemarketing-goals/:month/:year
 * @description List telemarketing goals for a specific period with role-based filtering
 */
telemarketingGoalsRouter.get("/:month/:year", getTelemarketingGoalsByPeriodController);
