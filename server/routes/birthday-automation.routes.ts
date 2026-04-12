import { Router } from "express";

import {
  sendBirthdayMessages,
  sendBirthdayMessagesScheduled,
} from "../jobs/send-birthday-mensage";

export const birthdayAutomationRouter = Router();

birthdayAutomationRouter.post("/trigger", async (_req, res) => {
  try {
    console.log(
      "[Manual Trigger] Disparando automação de aniversário manualmente...",
    );

    await sendBirthdayMessages();

    return res.json({
      success: true,
      message: "Automação de aniversário executada com sucesso",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Manual Trigger] Erro ao executar automação:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao executar automação de aniversário",
      error: error instanceof Error ? error.message : "Erro desconhecido",
      timestamp: new Date().toISOString(),
    });
  }
});

birthdayAutomationRouter.post("/trigger-scheduled", async (_req, res) => {
  try {
    console.log(
      "[Manual Trigger Scheduled] Disparando automação de aniversário agendada manualmente...",
    );

    await sendBirthdayMessagesScheduled();

    return res.json({
      success: true,
      message: "Automação de aniversário agendada executada com sucesso",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[Manual Trigger Scheduled] Erro ao executar automação agendada:",
      error,
    );
    return res.status(500).json({
      success: false,
      message: "Erro ao executar automação de aniversário agendada",
      error: error instanceof Error ? error.message : "Erro desconhecido",
      timestamp: new Date().toISOString(),
    });
  }
});

export default birthdayAutomationRouter;
