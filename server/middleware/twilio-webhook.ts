import { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { getTwilioConfig, getServerBaseUrl } from "../lib/twilio-config";

/**
 * Middleware Express para validar assinatura X-Twilio-Signature.
 * Bypass apenas em dev quando `TWILIO_SKIP_WEBHOOK_VERIFY=true`.
 * Em produção falha com 401/503 explicitamente; nunca aceita silenciosamente.
 */
export async function validateTwilioWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (process.env.TWILIO_SKIP_WEBHOOK_VERIFY === "true") {
      return next();
    }
    const { accountSid, authToken } = await getTwilioConfig();
    if (!accountSid || !authToken) {
      console.error(
        "[twilio-webhook] credenciais ausentes — rejeitando webhook",
      );
      res.status(503).send("Twilio não configurado");
      return;
    }
    const signature = req.headers["x-twilio-signature"] as string | undefined;
    if (!signature) {
      res.status(401).send("Assinatura ausente");
      return;
    }
    // Usa o host da requisição (URL real que o Twilio chamou) em vez de
    // getServerBaseUrl(), que pode retornar localhost e causar falha na validação.
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || req.protocol;
    const fullUrl = `${proto}://${req.headers.host}${req.originalUrl}`;
    const valid = twilio.validateRequest(authToken, signature, fullUrl, req.body);
    if (!valid) {
      console.warn(
        `[twilio-webhook] assinatura inválida para ${req.originalUrl}`,
      );
      res.status(401).send("Assinatura inválida");
      return;
    }
    next();
  } catch (e) {
    console.error("[twilio-webhook] erro:", e);
    res.status(500).send("Erro na validação");
  }
}
