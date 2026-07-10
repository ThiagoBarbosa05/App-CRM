import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "crypto";
import {
  listBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  duplicateBot,
  saveFlow,
} from "../services/whatsapp-bot.service";
import { r2 } from "../lib/r2";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.CLOUDFLARE_BUCKET_NAME || "crm-test";

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo não permitido: ${file.mimetype}`));
  },
});

const router = Router();

const createBotSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateBotSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
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
          // "question" mantido apenas para compatibilidade com fluxos legados;
          // o nó não é mais criável no editor.
          "question",
          "condition",
          "menu",
          "action",
          "flow_form",
          "wait",
          "end",
          "end_conversation",
          "transfer_agent",
          "distribute_flow",
          "edit_tags",
          "send_template",
          "trigger_flow",
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

router.get("/bots", async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const activeOnly = req.query.activeOnly === "true";
    const bots = await listBots(
      search || activeOnly ? { search: search || undefined, activeOnly } : undefined,
    );
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
    const parsed = updateBotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }
    const bot = await updateBot(req.params.id, parsed.data);
    res.json(bot);
  } catch {
    res.status(500).json({ message: "Erro ao atualizar bot" });
  }
});

router.post("/bots/:id/duplicate", async (req, res) => {
  try {
    const userId = (req as { user?: { userId: string } }).user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const flow = await duplicateBot(req.params.id, userId);
    res.status(201).json(flow);
  } catch (err) {
    if (err instanceof Error && err.message === "Bot not found") {
      return res.status(404).json({ message: "Bot não encontrado" });
    }
    res.status(500).json({ message: "Erro ao duplicar bot" });
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

// ─── Bot attachment upload / preview ─────────────────────────────────────────

router.post("/bots/attachments", attachmentUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
    const ext = req.file.originalname.includes(".")
      ? req.file.originalname.slice(req.file.originalname.lastIndexOf("."))
      : "";
    const storageKey = `bot-attachments/${randomUUID()}${ext}`;
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }),
    );
    const isImage = req.file.mimetype.startsWith("image/");
    return res.status(201).json({
      storageKey,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      type: isImage ? "image" : "document",
    });
  } catch (err) {
    console.error("[BotAttachment] upload error:", err);
    return res.status(500).json({ message: "Erro ao fazer upload do arquivo" });
  }
});

router.get("/bots/attachments/:key(*)", async (req, res) => {
  try {
    const storageKey = req.params.key;
    if (!storageKey.startsWith("bot-attachments/")) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }));
    res.setHeader("Content-Type", obj.ContentType ?? "application/octet-stream");
    if (obj.ContentLength != null) res.setHeader("Content-Length", String(obj.ContentLength));
    res.setHeader("Cache-Control", "private, max-age=3600");
    (obj.Body as NodeJS.ReadableStream).pipe(res);
  } catch (err: unknown) {
    const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name;
    if (code === "NoSuchKey" || code === "NotFound") return res.status(404).end();
    console.error("[BotAttachment] preview error:", err);
    return res.status(500).json({ message: "Erro ao buscar arquivo" });
  }
});

export default router;
