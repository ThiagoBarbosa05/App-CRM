import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import {
  getWhatsappSettingsForClient,
  getWhatsappStatus,
  upsertWhatsappSetting,
  WA_KEYS,
} from "../services/whatsapp-settings.service";
import {
  listLocalTemplates,
  createLocalTemplate,
  updateLocalTemplate,
  deleteLocalTemplate,
  fetchMetaTemplates,
  deleteMetaTemplate,
} from "../services/whatsapp-templates.service";
import { executeCampaign } from "../services/whatsapp-campaign.service";
import {
  createMetaTemplate,
  uploadTemplateMediaHandle,
  type MetaTemplateCreatePayload,
} from "../integrations/whatsapp";

const router = Router();

const templateMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

// ── Configurações ─────────────────────────────────────────────────────────────

router.get("/settings", async (req, res) => {
  try {
    const settings = await getWhatsappSettingsForClient();
    res.json(settings);
  } catch {
    res.status(500).json({ message: "Erro ao buscar configurações do WhatsApp" });
  }
});

router.get("/settings/status", async (req, res) => {
  try {
    const status = await getWhatsappStatus();
    res.json(status);
  } catch {
    res.status(500).json({ message: "Erro ao verificar status do WhatsApp" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const updates: Array<{ key: string; value: string }> = [];

    for (const key of WA_KEYS) {
      const incoming = body[key];
      if (incoming === undefined || incoming === null) continue;
      updates.push({ key, value: String(incoming) });
    }

    if (updates.length === 0) {
      return res.json({ updated: 0 });
    }

    await Promise.all(updates.map(({ key, value }) => upsertWhatsappSetting(key, value)));
    res.json({ updated: updates.length });
  } catch {
    res.status(500).json({ message: "Erro ao salvar configurações do WhatsApp" });
  }
});

// ── Templates locais ──────────────────────────────────────────────────────────

router.get("/templates", async (req, res) => {
  try {
    const templates = await listLocalTemplates();
    res.json(templates);
  } catch {
    res.status(500).json({ message: "Erro ao buscar templates" });
  }
});

const metaTemplateCreateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  language: z.string().min(2, "Idioma é obrigatório"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  parameter_format: z.enum(["NAMED", "POSITIONAL"]).optional(),
  components: z.array(z.unknown()).min(1, "Ao menos um componente é obrigatório"),
});

router.post("/templates/meta", async (req, res) => {
  try {
    const role = (req as any).user?.role;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const parsed = metaTemplateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }
    const result = await createMetaTemplate(parsed.data as MetaTemplateCreatePayload);
    res.status(201).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar template para o Meta";
    res.status(500).json({ message });
  }
});

router.get("/templates/meta", async (req, res) => {
  try {
    const templates = await fetchMetaTemplates();
    res.json(templates);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar templates do Meta";
    res.status(500).json({ message });
  }
});

router.delete("/templates/meta/:name", async (req, res) => {
  try {
    const role = (req as any).user?.role;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await deleteMetaTemplate(req.params.name);
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao excluir template do Meta";
    res.status(500).json({ message });
  }
});

// Upload de mídia de cabeçalho → retorna o handle exigido pela Meta
router.post("/templates/meta/media", templateMediaUpload.single("file"), async (req, res) => {
  try {
    const role = (req as any).user?.role;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

    const handle = await uploadTemplateMediaHandle(req.file.buffer, req.file.mimetype);
    res.json({ handle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar mídia para o Meta";
    res.status(500).json({ message });
  }
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  languageCode: z.string().min(1, "Idioma é obrigatório").default("pt_BR"),
  category: z.string().optional(),
  useCase: z.enum(["birthday_today", "birthday_days_before", "post_call", "campaign", "custom"]),
  description: z.string().optional(),
  headerParams: z.unknown().optional(),
  bodyParams: z.unknown().optional(),
  isActive: z.boolean().default(true),
});

router.post("/templates", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const template = await createLocalTemplate({ ...parsed.data, createdBy: userId });
    res.status(201).json(template);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao criar template";
    res.status(500).json({ message });
  }
});

router.put("/templates/:id", async (req, res) => {
  try {
    const parsed = createTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }

    const template = await updateLocalTemplate(req.params.id, parsed.data);
    res.json(template);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar template";
    res.status(500).json({ message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    await deleteLocalTemplate(req.params.id);
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao deletar template";
    res.status(500).json({ message });
  }
});

// ── Execução de campanha ──────────────────────────────────────────────────────

router.post("/campaigns/:id/execute", async (req, res) => {
  try {
    const result = await executeCampaign(req.params.id);
    res.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao executar campanha";
    res.status(500).json({ message });
  }
});

export default router;
