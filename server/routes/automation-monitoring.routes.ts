import { Router } from "express";
import {
  getAutomationOverview,
  getRuleClients,
  getExecutionHistory,
} from "../services/automation-monitoring.service";

export const automationMonitoringRouter = Router();

/**
 * GET /api/automation-monitoring/overview
 * Resumo por regra: status, clientes atualmente no fluxo, disparos e falhas recentes.
 */
automationMonitoringRouter.get("/overview", async (_req, res) => {
  try {
    const overview = await getAutomationOverview();
    res.json(overview);
  } catch (error) {
    console.error("Erro ao buscar visão geral de automações:", error);
    res.status(500).json({ message: "Erro ao buscar visão geral de automações" });
  }
});

/**
 * GET /api/automation-monitoring/rules/:ruleId/clients
 * Drill-down: clientes atualmente dentro do fluxo de uma regra específica.
 */
automationMonitoringRouter.get("/rules/:ruleId/clients", async (req, res) => {
  try {
    const rows = await getRuleClients(req.params.ruleId);
    res.json(rows);
  } catch (error) {
    console.error("Erro ao buscar clientes da regra de automação:", error);
    res.status(500).json({ message: "Erro ao buscar clientes da regra de automação" });
  }
});

/**
 * GET /api/automation-monitoring/history
 * Histórico de envios com filtros (clientId, ruleId, channel, status) e paginação.
 */
automationMonitoringRouter.get("/history", async (req, res) => {
  try {
    const { clientId, clientName, ruleId, channel, status, page, pageSize } = req.query;
    const result = await getExecutionHistory({
      clientId: typeof clientId === "string" ? clientId : undefined,
      clientName: typeof clientName === "string" && clientName.trim() ? clientName.trim() : undefined,
      ruleId: typeof ruleId === "string" ? ruleId : undefined,
      channel: channel === "sms" || channel === "email" ? channel : undefined,
      status: status === "success" || status === "failed" ? status : undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar histórico de execuções:", error);
    res.status(500).json({ message: "Erro ao buscar histórico de execuções" });
  }
});

export default automationMonitoringRouter;
