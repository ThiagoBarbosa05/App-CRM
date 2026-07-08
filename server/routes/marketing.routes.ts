import { Router, Request, Response, NextFunction } from "express";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { getMarketingSummaryController } from "../controllers/marketing/summary.controller";

export const marketingRouter = Router();

const MARKETING_SETTINGS_KEYS = [
  "sendgrid_api_key",
  "sendgrid_from_email",
  "sendgrid_from_name",
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
      .where(inArray(systemSettings.key, ["sendgrid_api_key", "sendgrid_from_email"]));
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const apiKey = map["sendgrid_api_key"] || process.env.SENDGRID_API_KEY || "";
    const fromEmail = map["sendgrid_from_email"] || process.env.SENDGRID_FROM_EMAIL || "";

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
 * @route POST /api/marketing/test-twilio
 * @description Verifica se as credenciais Twilio são válidas
 * @access Private (admin)
 */
marketingRouter.post("/test-twilio", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, ["twilio_account_sid", "twilio_auth_token", "marketing_sms_from_number"]));
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const accountSid = map["twilio_account_sid"] || process.env.TWILIO_ACCOUNT_SID || "";
    const authToken  = map["twilio_auth_token"]  || process.env.TWILIO_AUTH_TOKEN  || "";
    const fromNumber = map["marketing_sms_from_number"] || "";

    if (!accountSid || !authToken) {
      return res.status(400).json({ ok: false, message: "Account SID e Auth Token não configurados." });
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (twRes.ok) {
      const account = await twRes.json() as { friendly_name?: string; status?: string };
      return res.json({
        ok: true,
        message: `Conexão bem-sucedida!${account.friendly_name ? ` Conta: ${account.friendly_name}` : ""}${fromNumber ? ` | Número: ${fromNumber}` : ""}`,
      });
    }

    if (twRes.status === 401) {
      return res.status(400).json({ ok: false, message: "Account SID ou Auth Token inválidos." });
    }

    return res.status(400).json({ ok: false, message: `Erro Twilio: HTTP ${twRes.status}` });
  } catch {
    return res.status(500).json({ ok: false, message: "Não foi possível conectar ao Twilio. Verifique sua conexão." });
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
