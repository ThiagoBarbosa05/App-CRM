import { createHmac } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enqueueMock = vi.fn();
const drainMock = vi.fn();

vi.mock("../../services/baileys-gateway-webhook-inbox.service", () => ({
  enqueueGatewayWebhook: (...args: unknown[]) => enqueueMock(...args),
  drainGatewayWebhookInbox: (...args: unknown[]) => drainMock(...args),
}));

const SECRET = "segredo-de-teste";

function signedPost(app: Express, body: unknown, eventId = "evt-1") {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", SECRET)
    .update(`${timestamp}.${eventId}.${rawBody}`)
    .digest("hex");

  return request(app)
    .post("/evolution/webhook")
    .set("Content-Type", "application/json")
    .set("x-gateway-event-id", eventId)
    .set("x-gateway-timestamp", timestamp)
    .set("x-gateway-signature", signature)
    .send(rawBody);
}

const envelope = {
  event: "messages.upsert",
  instance: "canal-teste",
  data: { foo: "bar" },
};

/**
 * O inbox de webhooks perdeu o worker que varria a fila a cada 2 segundos —
 * era uma transação por tick mesmo com a fila vazia, e no Autoscale mantinha o
 * container aceso 24h. O processamento agora sai do próprio POST, depois da
 * resposta. Estes testes protegem essa troca.
 */
describe("POST /evolution/webhook", () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetModules();
    enqueueMock.mockReset();
    drainMock.mockReset();
    process.env.WEBHOOK_SIGNING_SECRET = SECRET;

    const [{ createRouteTestApp }, router] = await Promise.all([
      import("../../test/create-route-test-app"),
      import("../evolution-webhook.routes"),
    ]);
    app = createRouteTestApp({
      router: router.default,
      basePath: "/evolution",
      rawBody: true,
    });
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SIGNING_SECRET;
  });

  it("responde 202 e dispara o processamento quando o evento é novo", async () => {
    enqueueMock.mockResolvedValue("created");

    const response = await signedPost(app, envelope);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ status: "created" });
    expect(enqueueMock).toHaveBeenCalledWith("evt-1", expect.objectContaining(envelope));
    expect(drainMock).toHaveBeenCalledTimes(1);
  });

  it("responde 200 sem reprocessar quando o evento é duplicado", async () => {
    // Reentrega do gateway: o evento já está na fila ou já foi processado.
    enqueueMock.mockResolvedValue("duplicate");

    const response = await signedPost(app, envelope);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "duplicate" });
    expect(drainMock).not.toHaveBeenCalled();
  });

  it("rejeita assinatura inválida sem enfileirar nem processar", async () => {
    const response = await request(app)
      .post("/evolution/webhook")
      .set("Content-Type", "application/json")
      .set("x-gateway-event-id", "evt-2")
      .set("x-gateway-timestamp", String(Date.now()))
      .set("x-gateway-signature", "assinatura-errada")
      .send(JSON.stringify(envelope));

    expect(response.status).toBe(401);
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(drainMock).not.toHaveBeenCalled();
  });

  it("não processa quando a persistência falha", async () => {
    // Sem linha na tabela de inbox não há o que drenar, e o 500 faz o gateway
    // reentregar o evento.
    vi.spyOn(console, "error").mockImplementation(() => {});
    enqueueMock.mockRejectedValue(new Error("banco fora"));

    const response = await signedPost(app, envelope);

    expect(response.status).toBe(500);
    expect(drainMock).not.toHaveBeenCalled();
  });
});
