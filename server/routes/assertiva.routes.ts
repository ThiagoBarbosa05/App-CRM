import { Router } from "express";
import {
  getAssertivaStatus,
  forceRefreshAssertivaToken,
} from "../services/assertiva.service";

const router = Router();

router.get("/status", async (req, res) => {
  return res.json(await getAssertivaStatus());
});

router.post("/refresh", async (req, res) => {
  try {
    const status = await forceRefreshAssertivaToken();
    return res.json(status);
  } catch (err: any) {
    return res.status(502).json(await getAssertivaStatus());
  }
});

export default router;
