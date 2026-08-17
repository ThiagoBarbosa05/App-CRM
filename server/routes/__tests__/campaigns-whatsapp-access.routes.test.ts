import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAuthMiddleware, createRouteTestApp } from "../../test/create-route-test-app";

const { selectResults } = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
}));

vi.mock("../../db", () => {
  function select() {
    const result = selectResults.shift() ?? [];
    const chain = {
      from: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve(result),
      limit: () => Promise.resolve(result),
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    return chain;
  }

  return { db: { select: vi.fn(select) } };
});

vi.mock("../../lib/twilio-config", () => ({
  getTwilioConfig: vi.fn(),
  getTwilioChannels: vi.fn(),
  getServerBaseUrl: vi.fn(),
  toE164Brazil: vi.fn(),
}));

vi.mock("../../services/whatsapp-templates.service", () => ({
  ensureLocalTemplateForMeta: vi.fn(),
}));

vi.mock("../../services/whatsapp-channels.service", () => ({
  listChannelIdsForUser: vi.fn(),
  resolveChannelById: vi.fn(),
}));

vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: vi.fn(),
  BotCompatibilityLookupError: class BotCompatibilityLookupError extends Error {},
}));

import campaignsRouter from "../campaigns.routes";

type Role = "admin" | "gerente" | "vendedor";

function makeApp(role: Role) {
  return createRouteTestApp({
    router: campaignsRouter,
    basePath: "/api/campaigns",
    middlewares: [createMockAuthMiddleware({ userId: "user-1", role })],
  });
}

const whatsappIdentity = {
  id: "campaign-wa",
  waEnabled: true,
  umblerEnabled: false,
  whatsappCampaignId: null,
};

const telemarketingCampaign = {
  id: "campaign-tel",
  name: "Prospecção",
  waEnabled: false,
  umblerEnabled: false,
};

describe("autorização de campanhas WhatsApp no router misto", () => {
  beforeEach(() => {
    selectResults.length = 0;
  });

  it("omite campanhas WhatsApp da listagem do vendedor", async () => {
    selectResults.push([
      { campaign: telemarketingCampaign, whatsappCampaignId: null },
      {
        campaign: { ...telemarketingCampaign, id: "campaign-wa-config", waEnabled: true },
        whatsappCampaignId: null,
      },
      {
        campaign: { ...telemarketingCampaign, id: "campaign-wa-legacy", umblerEnabled: true },
        whatsappCampaignId: null,
      },
      {
        campaign: { ...telemarketingCampaign, id: "campaign-wa-materialized" },
        whatsappCampaignId: "campaign-wa-materialized",
      },
    ]);

    const res = await request(makeApp("vendedor")).get("/api/campaigns");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([telemarketingCampaign]);
  });

  it("rejeita criação de campanha WhatsApp por vendedor antes de gravar", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/campaigns")
      .send({ name: "Campanha WA", type: "humano", waEnabled: true });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: "Acesso restrito a administradores e gerentes",
      code: "FORBIDDEN",
    });
  });

  it("rejeita criação de campanha legada do WhatsApp por vendedor", async () => {
    const res = await request(makeApp("vendedor"))
      .post("/api/campaigns")
      .send({ name: "Campanha Umbler", type: "humano", umblerEnabled: true });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("impede vendedor de converter telemarketing em WhatsApp via PUT", async () => {
    selectResults.push([{
      id: "campaign-tel",
      waEnabled: false,
      umblerEnabled: false,
      whatsappCampaignId: null,
    }]);

    const res = await request(makeApp("vendedor"))
      .put("/api/campaigns/campaign-tel")
      .send({
        umblerEnabled: true,
        umblerChannelId: "channel-1",
        umblerBotId: "bot-1",
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it.each([
    ["get", "/campaign-wa"],
    ["put", "/campaign-wa"],
    ["delete", "/campaign-wa/incomplete"],
    ["delete", "/campaign-wa"],
    ["get", "/campaign-wa/clients"],
    ["post", "/campaign-wa/clients"],
    ["delete", "/campaign-wa/clients/client-1"],
    ["get", "/campaign-wa/triggers"],
    ["post", "/campaign-wa/triggers"],
    ["delete", "/campaign-wa/triggers/trigger-1"],
    ["get", "/campaign-wa/progress"],
    ["get", "/campaign-wa/stats"],
    ["get", "/campaign-wa/calls"],
    ["post", "/campaign-wa/dispatch"],
  ] as const)("bloqueia vendedor em %s %s", async (method, path) => {
    selectResults.push([whatsappIdentity]);

    const res = await request(makeApp("vendedor"))[method](`/api/campaigns${path}`).send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it.each(["admin", "gerente"] as const)("permite detalhes de campanha WhatsApp para %s", async (role) => {
    selectResults.push([{ ...whatsappIdentity, name: "Campanha WA" }]);

    const res = await request(makeApp(role)).get("/api/campaigns/campaign-wa");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "campaign-wa", name: "Campanha WA" });
  });

  it("preserva detalhes de telemarketing para vendedor", async () => {
    selectResults.push([{
      id: "campaign-tel",
      waEnabled: false,
      umblerEnabled: false,
      whatsappCampaignId: null,
    }]);
    selectResults.push([telemarketingCampaign]);

    const res = await request(makeApp("vendedor")).get("/api/campaigns/campaign-tel");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(telemarketingCampaign);
  });
});
