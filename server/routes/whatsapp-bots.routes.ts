import { Router } from "express";
import { z } from "zod";
import {
  listBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  saveFlow,
} from "../services/whatsapp-bot.service";

const router = Router();

const createBotSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["keyword", "new_conversation"]),
  triggerKeyword: z.string().optional(),
  isActive: z.boolean().default(true),
});

const saveFlowSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string(),
        botId: z.string(),
        type: z.enum([
          "start",
          "send_message",
          "question",
          "condition",
          "action",
          "end",
        ]),
        label: z.string(),
        positionX: z.number(),
        positionY: z.number(),
        data: z.record(z.unknown()).default({}),
      }),
    )
    .default([]),
  edges: z
    .array(
      z.object({
        id: z.string(),
        botId: z.string(),
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
        sourceHandle: z.string().nullable().optional(),
        label: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

router.get("/bots", async (_req, res) => {
  try {
    const bots = await listBots();
    res.json(bots);
  } catch {
    res.status(500).json({ message: "Erro ao listar bots" });
  }
});

router.post("/bots", async (req, res) => {
  try {
    const userId = (req as { user?: { userId: string } }).user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = createBotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const flow = await createBot({ ...parsed.data, createdBy: userId });
    res.status(201).json(flow);
  } catch {
    res.status(500).json({ message: "Erro ao criar bot" });
  }
});

router.get("/bots/:id", async (req, res) => {
  try {
    const flow = await getBot(req.params.id);
    if (!flow) return res.status(404).json({ message: "Bot não encontrado" });
    res.json(flow);
  } catch {
    res.status(500).json({ message: "Erro ao buscar bot" });
  }
});

router.put("/bots/:id", async (req, res) => {
  try {
    const parsed = createBotSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }
    const bot = await updateBot(req.params.id, parsed.data);
    res.json(bot);
  } catch {
    res.status(500).json({ message: "Erro ao atualizar bot" });
  }
});

router.delete("/bots/:id", async (req, res) => {
  try {
    await deleteBot(req.params.id);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Erro ao excluir bot" });
  }
});

router.put("/bots/:id/flow", async (req, res) => {
  try {
    const parsed = saveFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }
    await saveFlow(req.params.id, parsed.data.nodes, parsed.data.edges);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Erro ao salvar fluxo" });
  }
});

router.post("/bots/:id/activate", async (req, res) => {
  try {
    const bot = await updateBot(req.params.id, { isActive: true });
    res.json(bot);
  } catch {
    res.status(500).json({ message: "Erro ao ativar bot" });
  }
});

router.post("/bots/:id/deactivate", async (req, res) => {
  try {
    const bot = await updateBot(req.params.id, { isActive: false });
    res.json(bot);
  } catch {
    res.status(500).json({ message: "Erro ao desativar bot" });
  }
});

export default router;
