import { Router, Request, Response, NextFunction } from "express";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { getMarketingSummaryController } from "../controllers/marketing/summary.controller";

export const marketingRouter = Router();

const MARKETING_SETTINGS_KEYS = [
  "marketing_sendgrid_api_key",
  "marketing_sendgrid_from_email",
  "marketing_sendgrid_from_name",
  "marketing_sms_from_number",
];

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  return next();
}

/**
 * @route GET /api/marketing/summary
 * @description Contadores de envio por canal (WhatsApp/Email/SMS) dos últimos 30 dias
 * @access Private
 */
marketingRouter.get("/summary", getMarketingSummaryController);

/**
 * @route GET /api/marketing/settings
 * @description Retorna configurações de integrações de marketing
 * @access Private (admin)
 */
marketingRouter.get("/settings", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, MARKETING_SETTINGS_KEYS));
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    res.json(map);
  } catch {
    res.status(500).json({ message: "Erro ao buscar configurações de marketing" });
  }
});

/**
 * @route POST /api/marketing/test-sendgrid
 * @description Verifica se a API Key do SendGrid é válida
 * @access Private (admin)
 */
marketingRouter.post("/test-sendgrid", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["marketing_sendgrid_api_key", "marketing_sendgrid_from_email"]));
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const apiKey = map["marketing_sendgrid_api_key"];
    const fromEmail = map["marketing_sendgrid_from_email"];

    if (!apiKey) {
      return res.status(400).json({ ok: false, message: "API Key não configurada." });
    }

    const sgRes = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (sgRes.ok) {
      const profile = await sgRes.json() as { username?: string; email?: string };
      return res.json({
        ok: true,
        message: `Conexão bem-sucedida!${profile.username ? ` Conta: ${profile.username}` : ""}${fromEmail ? ` | Remetente: ${fromEmail}` : ""}`,
      });
    }

    if (sgRes.status === 401) {
      return res.status(400).json({ ok: false, message: "API Key inválida ou expirada." });
    }
    if (sgRes.status === 403) {
      return res.status(400).json({ ok: false, message: "API Key sem permissão. Verifique os escopos no SendGrid." });
    }

    return res.status(400).json({ ok: false, message: `Erro do SendGrid: HTTP ${sgRes.status}` });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Não foi possível conectar ao SendGrid. Verifique sua conexão." });
  }
});

/**
 * @route PUT /api/marketing/settings
 * @description Salva configurações de integrações de marketing
 * @access Private (admin)
 */
marketingRouter.put("/settings", requireAdmin, async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const entries = Object.entries(body).filter(([key]) =>
      MARKETING_SETTINGS_KEYS.includes(key)
    );
    if (entries.length === 0) {
      return res.status(400).json({ message: "Nenhuma configuração válida enviada" });
    }
    for (const [key, value] of entries) {
      await db
        .insert(systemSettings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: String(value) },
        });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Erro ao salvar configurações de marketing" });
  }
});
