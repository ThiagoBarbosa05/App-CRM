import { Router } from "express";

import {
  getBirthdayBots,
  getBirthdayDaysBeforeBotAutomation,
  getBirthdayTodayBotsAutomation,
  getBot,
  getBots,
  getChannels,
  getManualStartsBot,
  startBirthdayBot,
} from "../integrations/umbler";

export const umblerRouter = Router();

umblerRouter.get("/umbler/channels", async (_req, res) => {
  try {
    const channels = await getChannels();
    return res.json(channels);
  } catch (error) {
    console.error("Erro ao buscar canais:", error);
    return res.status(500).json({ message: "Erro ao buscar canais" });
  }
});

umblerRouter.get("/umbler/whatsapp-api/channels", async (_req, res) => {
  try {
    const channels = await getChannels();
    return res.json(channels);
  } catch (error) {
    console.error("Erro ao buscar canais:", error);
    return res.status(500).json({ message: "Erro ao buscar canais" });
  }
});

umblerRouter.get("/umbler/bot", async (req, res) => {
  try {
    const { title } = req.query as { title: string };
    const result = await getBot(title);

    return res.json({ result: result?.items });
  } catch (error) {
    console.error("Erro ao buscar bot:", error);
    return res.status(500).json({ message: "Erro ao buscar bot" });
  }
});

umblerRouter.get("/umbler/manual-starts/bot", async (req, res) => {
  try {
    const { query, hidden } = req.query as {
      query?: string;
      hidden?: string;
    };

    console.log("Buscando bots com parâmetros:", { query, hidden });

    const result = await getManualStartsBot(query || "");

    if (!result) {
      console.error("getManualStartsBot retornou null");
      return res.status(500).json({
        message: "Erro ao buscar bots",
        error: "API retornou null",
      });
    }

    console.log("Bots recebidos:", result);
    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar bot:", error);
    return res.status(500).json({
      message: "Erro ao buscar bot",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

umblerRouter.get("/umbler/bots", async (req, res) => {
  try {
    const { query, skip, take, hidden } = req.query;

    const skipNumber = skip ? parseInt(skip as string, 10) : 0;
    const takeNumber = take ? parseInt(take as string, 10) : 34;
    const hiddenBoolean = hidden === "true";

    const bots = await getBots(
      query as string | undefined,
      skipNumber,
      takeNumber,
      // hiddenBoolean
    );

    void hiddenBoolean;

    if (!bots) {
      return res.status(500).json({ error: "Failed to fetch bots" });
    }

    return res.json(bots);
  } catch (error) {
    console.error("Erro ao buscar bots:", error);
    return res.status(500).json({
      message: "Erro ao buscar bots",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/birthday-bots", async (_req, res) => {
  try {
    const bots = await getBirthdayBots();
    return res.json({ items: bots?.items });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário:", error);
    return res.status(500).json({ message: "Erro ao buscar bots de aniversário" });
  }
});

umblerRouter.get("/umbler/birthday-bots-today", async (_req, res) => {
  try {
    const bots = await getBirthdayTodayBotsAutomation();
    return res.json({ items: bots?.items || [] });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário do dia:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar bots de aniversário do dia" });
  }
});

umblerRouter.get("/umbler/birthday-bots-days-before", async (_req, res) => {
  try {
    const bots = await getBirthdayDaysBeforeBotAutomation();
    return res.json({ items: bots?.items || [] });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário dias antes:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar bots de aniversário dias antes" });
  }
});

umblerRouter.post("/start/birthday-bot", async (req, res) => {
  try {
    const { botId, chatId, triggerName } = req.body as {
      chatId: string;
      botId: string;
      triggerName: string;
    };

    const result = await startBirthdayBot({
      botId,
      chatId,
      triggerName,
    });

    return res
      .status(201)
      .json({ message: "Bot de aniversário iniciado com sucesso", result });
  } catch (error) {
    console.error("Erro ao iniciar bot de aniversário:", error);
    return res.status(500).json({ message: "Erro ao iniciar bot de aniversário" });
  }
});

export default umblerRouter;
