import { Router, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { blingConnections } from "../../shared/schema";
import { decryptToken } from "../lib/token-crypto";
import {
  verifyBlingSignature,
  enqueueWebhookEvent,
  type BlingWebhookEvent,
} from "../services/bling-webhook.service";

const router = Router();

/**
 * POST /api/bling/webhook/:connectionId
 *
 * Endpoint público (sem requireAuth) chamado diretamente pelo Bling.
 * O connectionId na URL identifica univocamente a conexão Bling.
 *
 * Fluxo:
 * 1. Parseia o JSON do rawBody capturado pelo `express.json({ verify })`.
 * 2. Busca a conexão pelo connectionId da URL.
 * 3. Verifica a assinatura HMAC-SHA256 do header `X-Bling-Signature-256`.
 * 4. Responde 200 imediatamente (Bling exige resposta em até 5 segundos).
 * 5. Enfileira o evento para processamento assíncrono com rate limit.
 */
router.post("/webhook/:connectionId", async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody || rawBody.length === 0) {
    res.status(400).json({ error: "Body vazio ou não capturado" });
    return;
  }

  // Parse manual do body raw
  let event: BlingWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as BlingWebhookEvent;
  } catch {
    res.status(400).json({ error: "JSON inválido" });
    return;
  }

  if (!event.eventId || !event.event || !event.data) {
    res.status(400).json({ error: "Payload de webhook inválido" });
    return;
  }

  const { connectionId } = req.params;

  // Resolve a conexão pelo connectionId da URL
  let connection;
  try {
    const [found] = await db
      .select()
      .from(blingConnections)
      .where(
        and(
          eq(blingConnections.id, connectionId),
          inArray(blingConnections.status, ["connected", "reauth_required"]),
        ),
      )
      .limit(1);
    connection = found ?? null;
  } catch (error) {
    console.error("[BlingWebhook] Erro ao buscar conexão:", error);
    res.status(500).json({ error: "Erro interno ao processar webhook" });
    return;
  }

  if (!connection) {
    res.status(404).json({ error: "Conexão não encontrada" });
    return;
  }

  // Verifica assinatura HMAC com o clientSecret da conexão
  const signatureHeader = req.headers["x-bling-signature-256"] as
    | string
    | undefined;

  if (!signatureHeader) {
    console.warn(
      `[BlingWebhook] Header X-Bling-Signature-256 ausente para evento ${event.eventId}`,
    );
    res.status(400).json({ error: "Assinatura ausente" });
    return;
  }

  let isValidSignature = false;
  try {
    const clientSecret = decryptToken(connection.oauthClientSecretEncrypted);
    isValidSignature = verifyBlingSignature(
      rawBody,
      clientSecret,
      signatureHeader,
    );
  } catch (error) {
    console.error("[BlingWebhook] Erro ao verificar assinatura:", error);
    res.status(500).json({ error: "Erro ao verificar assinatura" });
    return;
  }

  if (!isValidSignature) {
    console.warn(
      `[BlingWebhook] Assinatura inválida para evento ${event.eventId} (connectionId: ${connectionId})`,
    );
    res.status(400).json({ error: "Assinatura inválida" });
    return;
  }

  // Responde imediatamente para cumprir o SLA de 5 segundos do Bling
  res.status(200).json({ received: true });

  // Enfileira para processamento assíncrono (sem await)
  enqueueWebhookEvent(event, connection);
});

export default router;
