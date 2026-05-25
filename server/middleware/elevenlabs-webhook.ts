import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

let cachedSecret: { value: string | null; at: number } | null = null;

async function getElevenLabsWebhookSecret(): Promise<string | null> {
  if (cachedSecret && Date.now() - cachedSecret.at < 60_000) {
    return cachedSecret.value;
  }
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "elevenlabs_webhook_secret"));
  const value = row?.value || process.env.ELEVENLABS_WEBHOOK_SECRET || null;
  cachedSecret = { value, at: Date.now() };
  return value;
}

/**
 * Valida assinatura HMAC enviada pelo ElevenLabs no header `elevenlabs-signature`.
 * Formato: `t=<unix_ts>,v0=<hex>`
 * Bypass em dev via `ELEVENLABS_SKIP_WEBHOOK_VERIFY=true`.
 */
export async function validateElevenLabsSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (process.env.ELEVENLABS_SKIP_WEBHOOK_VERIFY === "true") {
      return next();
    }

    const secret = await getElevenLabsWebhookSecret();
    if (!secret) {
      console.error(
        "[elevenlabs-webhook] secret não configurado — rejeitando webhook",
      );
      res.status(503).json({ message: "Webhook secret não configurado" });
      return;
    }

    const header = req.headers["elevenlabs-signature"] as string | undefined;
    if (!header) {
      res.status(401).json({ message: "Assinatura ausente" });
      return;
    }

    const parts = header.split(",").reduce<Record<string, string>>((acc, p) => {
      const [k, v] = p.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const timestamp = parts.t;
    const signature = parts.v0;
    if (!timestamp || !signature) {
      res.status(401).json({ message: "Assinatura malformada" });
      return;
    }

    // Janela anti-replay: 30 minutos
    const tsSec = parseInt(timestamp, 10);
    if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 1800) {
      res.status(401).json({ message: "Timestamp fora da janela" });
      return;
    }

    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) {
      res.status(500).json({ message: "Raw body não capturado" });
      return;
    }

    const payload = `${timestamp}.${raw.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(401).json({ message: "Assinatura inválida" });
      return;
    }

    next();
  } catch (e) {
    console.error("[elevenlabs-webhook] erro na validação:", e);
    res.status(500).json({ message: "Erro na validação de assinatura" });
  }
}
