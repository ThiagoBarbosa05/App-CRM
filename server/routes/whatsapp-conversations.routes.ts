import { Router } from "express";
import { z } from "zod";
import {
  listClientsForChat,
  getConversation,
  sendConversationMessage,
} from "../services/whatsapp-conversations.service";

const router = Router();

router.get("/conversations", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await listClientsForChat(user.userId, user.role, search);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Erro ao listar clientes" });
  }
});

router.get("/conversations/:clientId", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const messages = await getConversation(req.params.clientId, user.userId, user.role);
    if (messages === null) return res.status(404).json({ message: "Cliente não encontrado" });

    res.json(Array.isArray(messages) ? messages : []);
  } catch {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
});

router.post("/conversations/:clientId/messages", async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    console.log(`[WA Conversations] Enviando mensagem para cliente ${req.params.clientId} por usuário ${user.userId}`);

    const result = await sendConversationMessage(
      req.params.clientId,
      parsed.data.message,
      user.userId,
      user.role,
    );

    if (result === null) {
      console.warn(`[WA Conversations] sendConversationMessage retornou null para cliente ${req.params.clientId}`);
      return res.status(400).json({ message: "Não foi possível enviar a mensagem" });
    }

    console.log(`[WA Conversations] Mensagem enviada com sucesso:`, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    console.error(`[WA Conversations] Erro ao enviar mensagem:`, err);
    res.status(500).json({ message: "Erro ao enviar mensagem", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
