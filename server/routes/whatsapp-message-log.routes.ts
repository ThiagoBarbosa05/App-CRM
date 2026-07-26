import { Router } from "express";
import { z } from "zod";
import {
  listWhatsappMessageLog,
  parseMessageLogQuery,
} from "../controllers/whatsapp/message-log.controller";

const router = Router();

// ── Log de mensagens (enviadas e recebidas) através de todas as conversas ────

router.get("/message-log", async (req, res) => {
  try {
    const filters = parseMessageLogQuery(req.query as Record<string, unknown>);
    const result = await listWhatsappMessageLog(filters);
    res.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Parâmetros inválidos", errors: e.flatten() });
    }
    console.error("[WA MessageLog] Erro ao listar mensagens:", e);
    res.status(500).json({ message: "Erro ao buscar log de mensagens" });
  }
});

export default router;
