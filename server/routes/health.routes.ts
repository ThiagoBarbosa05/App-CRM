import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  return res.json({ status: "ok" });
});

export default healthRouter;
