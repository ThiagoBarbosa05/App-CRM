import { Router } from "express";
import { getOpenAIStatus, testOpenAIConnection } from "../services/openai-status.service";

const router = Router();

router.get("/status", (req, res) => {
  return res.json(getOpenAIStatus());
});

router.post("/test", async (req, res) => {
  const status = await testOpenAIConnection();
  return res.json(status);
});

export default router;
