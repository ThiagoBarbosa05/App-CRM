import request from "supertest";
import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouteTestApp } from "../../test/create-route-test-app";

const {
  enqueueWhatsappCloudWebhookMock,
  getWhatsappSettingsRawMock,
  getChannelByPhoneNumberIdMock,
  isSameChannelPhoneMock,
  registerWhatsappCloudWebhookDispatcherMock,
  saveInboundMessageMock,
} = vi.hoisted(() => ({
  enqueueWhatsappCloudWebhookMock: vi.fn(),
  getWhatsappSettingsRawMock: vi.fn(),
  getChannelByPhoneNumberIdMock: vi.fn(),
  isSameChannelPhoneMock: vi.fn(),
  registerWhatsappCloudWebhookDispatcherMock: vi.fn(),
  saveInboundMessageMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-cloud-webhook-inbox.service", () => ({
  enqueueWhatsappCloudWebhook: enqueueWhatsappCloudWebhookMock,
  registerWhatsappCloudWebhookDispatcher: registerWhatsappCloudWebhookDispatcherMock,
}));
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../services/whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: getWhatsappSettingsRawMock, upsertWhatsappSetting: vi.fn(),
}));
vi.mock("../../services/whatsapp-campaign-status.service", () => ({
  applyCampaignDeliveryStatus: vi.fn(), STATUS_RANK: {},
}));
vi.mock("../../services/whatsapp-bot-engine.service", () => ({
  handleInboundBotMessage: vi.fn(), handleFlowResponse: vi.fn(),
  handleTemplateDeliveryFailure: vi.fn(), persistBotMessage: vi.fn(),
}));
vi.mock("../../services/whatsapp-conversations.service", () => ({
  saveInboundMessage: saveInboundMessageMock, saveInboundReaction: vi.fn(),
}));
vi.mock("../../services/whatsapp-channels.service", () => ({
  getChannelByPhoneNumberId: getChannelByPhoneNumberIdMock,
  isSameChannelPhone: isSameChannelPhoneMock,
}));
vi.mock("../../services/whatsapp-account-events.service", () => ({ logAccountEvent: vi.fn() }));
vi.mock("../../services/whatsapp-templates.service", () => ({
  updateTemplateMetaStatus: vi.fn(), updateTemplateQualityScore: vi.fn(),
}));
vi.mock("../../integrations/whatsapp", () => ({ sendTextMessage: vi.fn() }));
vi.mock("../../lib/sse-hub", () => ({ publishConversationEvent: vi.fn() }));
vi.mock("../../services/whatsapp-opt-out.service", () => ({
  optOutClientByPhone: vi.fn(), optInClientByPhone: vi.fn(), matchOptKeyword: vi.fn(),
  OPT_OUT_CONFIRMATION_TEXT: "", OPT_IN_CONFIRMATION_TEXT: "",
}));

import whatsappWebhookRouter from "../whatsapp-webhook.routes";

const APP_SECRET = "test-app-secret";

function signWebhookPayload(payload: Record<string, unknown>): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  return {
    body,
    signature: `sha256=${crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex")}`,
  };
}

describe("POST /webhook — inbox durável da Cloud API", () => {
  beforeEach(() => {
    enqueueWhatsappCloudWebhookMock.mockReset();
    getWhatsappSettingsRawMock.mockReset().mockResolvedValue({ wa_app_secret: APP_SECRET });
    getChannelByPhoneNumberIdMock.mockReset();
    isSameChannelPhoneMock.mockReset();
    saveInboundMessageMock.mockReset();
    getChannelByPhoneNumberIdMock.mockResolvedValue(null);
    isSameChannelPhoneMock.mockReturnValue(false);
    saveInboundMessageMock.mockResolvedValue({
      saved: false,
      conversationId: null,
      direction: null,
      channelId: null,
      startsConversation: false,
    });
  });

  it("só confirma a Meta depois de persistir o payload", async () => {
    enqueueWhatsappCloudWebhookMock.mockResolvedValue("created");
    const payload = { object: "whatsapp_business_account", entry: [] };
    const { body, signature } = signWebhookPayload(payload);
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp", rawBody: true });

    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(body);

    expect(response.status).toBe(202);
    expect(enqueueWhatsappCloudWebhookMock).toHaveBeenCalledWith(payload);
  });

  it("não confirma o webhook quando a persistência falha", async () => {
    enqueueWhatsappCloudWebhookMock.mockRejectedValue(new Error("database unavailable"));
    const payload = { object: "whatsapp_business_account", entry: [] };
    const { body, signature } = signWebhookPayload(payload);
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp", rawBody: true });

    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(body);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Falha ao persistir evento" });
  });

  it("rejeita uma assinatura inválida antes de enfileirar o payload", async () => {
    const payload = { object: "whatsapp_business_account", entry: [] };
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp", rawBody: true });

    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=invalid")
      .send(JSON.stringify(payload));

    expect(response.status).toBe(401);
    expect(enqueueWhatsappCloudWebhookMock).not.toHaveBeenCalled();
  });

  it("rejeita o webhook quando o App Secret não está configurado", async () => {
    getWhatsappSettingsRawMock.mockResolvedValue({});
    const payload = { object: "whatsapp_business_account", entry: [] };
    const { body, signature } = signWebhookPayload(payload);
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp", rawBody: true });

    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(body);

    expect(response.status).toBe(503);
    expect(enqueueWhatsappCloudWebhookMock).not.toHaveBeenCalled();
  });

  it("processa mensagens do mesmo payload em ordem, sem iniciar a próxima antes da persistência anterior", async () => {
    const dispatcher = registerWhatsappCloudWebhookDispatcherMock.mock.calls[0]?.[0] as
      | ((payload: Record<string, unknown>) => Promise<void>)
      | undefined;
    expect(dispatcher).toBeDefined();

    const order: string[] = [];
    let releaseFirstSave: (() => void) | undefined;
    const firstSaveStarted = new Promise<void>((resolve) => {
      saveInboundMessageMock.mockImplementationOnce(async (data: { waMessageId: string }) => {
        order.push(`${data.waMessageId}:start`);
        resolve();
        await new Promise<void>((continueSave) => {
          releaseFirstSave = continueSave;
        });
        order.push(`${data.waMessageId}:end`);
        return { saved: false, conversationId: null, direction: null, channelId: null, startsConversation: false };
      });
    });
    saveInboundMessageMock.mockImplementationOnce(async (data: { waMessageId: string }) => {
      order.push(`${data.waMessageId}:start`);
      order.push(`${data.waMessageId}:end`);
      return { saved: false, conversationId: null, direction: null, channelId: null, startsConversation: false };
    });

    const processing = dispatcher!({
      entry: [{
        changes: [{
          field: "messages",
          value: {
            metadata: { phone_number_id: "phone-id", display_phone_number: "5511999999999" },
            messages: [
              { id: "first", from: "5511988888888", type: "text", timestamp: "10", text: { body: "primeira" } },
              { id: "second", from: "5511988888888", type: "text", timestamp: "11", text: { body: "segunda" } },
            ],
          },
        }],
      }],
    });

    await firstSaveStarted;
    expect(order).toEqual(["first:start"]);

    releaseFirstSave?.();
    await processing;
    expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
