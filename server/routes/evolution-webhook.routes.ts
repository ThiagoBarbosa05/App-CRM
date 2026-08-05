import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  enqueueGatewayWebhook,
  type GatewayWebhookEnvelope,
} from "../services/baileys-gateway-webhook-inbox.service";

const router = Router();
const envelopeSchema = z.object({
  event: z.enum([
    "messages.upsert",
    "messages.update",
    "messages.reaction",
    "connection.update",
    "qrcode.updated",
  ]),
  instance: z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/),
  data: z.unknown(),
  // Instante do evento no gateway. Zod remove chaves desconhecidas, então
  // precisa estar declarado aqui para chegar ao inbox — é a guarda de ordem
  // contra reentregas fora de sequência. Opcional: gateways antigos não enviam.
  occurredAt: z.string().datetime().optional(),
});

export function verifyGatewayWebhookSignature(input: {
  rawBody: Buffer;
  eventId: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: number;
}): boolean {
  const { rawBody, eventId, timestamp, signature, secret, now = Date.now() } = input;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(now - timestampNumber) > 300_000) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.${rawBody.toString("utf8")}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
}

function hasValidSignature(req: Request): boolean {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const eventId = req.header("x-gateway-event-id");
  const timestamp = req.header("x-gateway-timestamp");
  const signature = req.header("x-gateway-signature");
  if (!secret || !rawBody || !eventId || !timestamp || !signature) return false;
  return verifyGatewayWebhookSignature({
    rawBody,
    eventId,
    timestamp,
    signature,
    secret,
  });
}

router.post("/webhook", async (req: Request, res: Response) => {
  if (!process.env.WEBHOOK_SIGNING_SECRET) {
    res.status(503).json({ message: "Webhook do gateway não configurado" });
    return;
  }
  if (!hasValidSignature(req)) {
    res.status(401).json({ message: "Assinatura inválida" });
    return;
  }
  const parsed = envelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Evento inválido", issues: parsed.error.issues });
    return;
  }
  const eventId = req.header("x-gateway-event-id");
  if (!eventId) {
    res.status(400).json({ message: "x-gateway-event-id ausente" });
    return;
  }
  try {
    const result = await enqueueGatewayWebhook(
      eventId,
      parsed.data as GatewayWebhookEnvelope,
    );
    res.status(result === "created" ? 202 : 200).json({ status: result });
  } catch (error) {
    console.error("[Baileys Gateway Webhook] Falha ao persistir:", error);
    res.status(500).json({ message: "Falha ao persistir evento" });
  }
});

export default router;
