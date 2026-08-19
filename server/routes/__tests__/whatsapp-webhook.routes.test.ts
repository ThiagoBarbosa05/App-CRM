import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createRouteTestApp } from "../../test/create-route-test-app";

const { enqueueWhatsappCloudWebhookMock } = vi.hoisted(() => ({
  enqueueWhatsappCloudWebhookMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-cloud-webhook-inbox.service", () => ({
  enqueueWhatsappCloudWebhook: enqueueWhatsappCloudWebhookMock,
  registerWhatsappCloudWebhookDispatcher: vi.fn(),
}));
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../services/whatsapp-settings.service", () => ({
  getWhatsappSettingsRaw: vi.fn(), upsertWhatsappSetting: vi.fn(),
}));
vi.mock("../../services/whatsapp-campaign-status.service", () => ({
  applyCampaignDeliveryStatus: vi.fn(), STATUS_RANK: {},
}));
vi.mock("../../services/whatsapp-bot-engine.service", () => ({
  handleInboundBotMessage: vi.fn(), handleFlowResponse: vi.fn(),
  handleTemplateDeliveryFailure: vi.fn(), persistBotMessage: vi.fn(),
}));
vi.mock("../../services/whatsapp-conversations.service", () => ({
  saveInboundMessage: vi.fn(), saveInboundReaction: vi.fn(),
}));
vi.mock("../../services/whatsapp-channels.service", () => ({
  getChannelByPhoneNumberId: vi.fn(), isSameChannelPhone: vi.fn(),
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

describe("POST /webhook — inbox durável da Cloud API", () => {
  it("só confirma a Meta depois de persistir o payload", async () => {
    enqueueWhatsappCloudWebhookMock.mockResolvedValue("created");
    const payload = { object: "whatsapp_business_account", entry: [] };
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp" });

    const response = await request(app).post("/api/whatsapp/webhook").send(payload);

    expect(response.status).toBe(202);
    expect(enqueueWhatsappCloudWebhookMock).toHaveBeenCalledWith(payload);
  });

  it("não confirma o webhook quando a persistência falha", async () => {
    enqueueWhatsappCloudWebhookMock.mockRejectedValue(new Error("database unavailable"));
    const app = createRouteTestApp({ router: whatsappWebhookRouter, basePath: "/api/whatsapp" });

    const response = await request(app)
      .post("/api/whatsapp/webhook")
      .send({ object: "whatsapp_business_account", entry: [] });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Falha ao persistir evento" });
  });
});
