import { Router, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { deterministicEvolutionEventId, enqueueEvolutionWebhook, normalizeEvolutionWebhook } from "../services/evolution-webhook-inbox.service";

const router = Router();
const schema = z.object({ event: z.unknown(), instance: z.unknown(), data: z.unknown() }).passthrough();

router.post("/webhook", async (req: Request, res: Response) => {
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
  const supplied = req.header("x-evolution-webhook-token");
  if (!expected || !supplied || expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) { res.status(401).json({ message: "Token Evolution inválido" }); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Evento Evolution inválido", issues: parsed.error.issues }); return; }
  let event: ReturnType<typeof normalizeEvolutionWebhook>;
  try { event = normalizeEvolutionWebhook(parsed.data); } catch (error) { res.status(400).json({ message: "Evento Evolution inválido", issues: [{ path: ["event"], message: error instanceof Error ? error.message : "Formato inválido" }] }); return; }
  const eventId = req.header("x-evolution-event-id") ?? deterministicEvolutionEventId(event.instance, event.event, event.raw);
  try { const result = await enqueueEvolutionWebhook(eventId, event); res.status(result === "created" ? 202 : 200).json({ status: result }); } catch (error) { console.error("[Evolution v2 Webhook] Falha ao persistir:", error); res.status(500).json({ message: "Falha ao persistir evento" }); }
});

export default router;
