import { Router } from "express";

import { storage } from "../storage";

export const dashboardRouter = Router();

dashboardRouter.get("/stats/:userId", async (req, res) => {
  try {
    const stats = await storage.getDashboardStats(req.params.userId);
    return res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default dashboardRouter;
