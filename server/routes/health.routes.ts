import { Router } from "express";
import { getGatewayConfigurationStatus } from "../integrations/baileys-gateway";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  return res.json({ status: "ok" });
});

healthRouter.get("/gateway", (_req, res) => {
  const gateway = getGatewayConfigurationStatus();
  return res.status(gateway.configured ? 200 : 503).json({
    status: gateway.configured ? "ok" : "misconfigured",
    configured: gateway.configured,
    missing: gateway.missing,
  });
});

export default healthRouter;
