import { Router } from "express";
import {
  getTelemarketingGoalsController,
  getTelemarketingGoalsByPeriodController,
  postTelemarketingGoalController,
  putTelemarketingGoalController,
  deleteTelemarketingGoalController,
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

/**
 * @route POST /api/telemarketing-goals
 * @description Create a new telemarketing goal
 */
telemarketingGoalsRouter.post("/", postTelemarketingGoalController);

/**
 * @route PUT /api/telemarketing-goals/:id
 * @description Update an existing telemarketing goal
 */
telemarketingGoalsRouter.put("/:id", putTelemarketingGoalController);
telemarketingGoalsRouter.patch("/:id", putTelemarketingGoalController);

/**
 * @route DELETE /api/telemarketing-goals/:id
 * @description Delete a telemarketing goal
 */
telemarketingGoalsRouter.delete("/:id", deleteTelemarketingGoalController);
