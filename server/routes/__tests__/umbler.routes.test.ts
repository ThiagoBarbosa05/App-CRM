import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { umblerRouter } from "../umbler.routes";

const {
  getChannelsMock,
  getBotMock,
  getManualStartsBotMock,
  getBotsMock,
  getBirthdayBotsMock,
  getBirthdayTodayBotsAutomationMock,
  getBirthdayDaysBeforeBotAutomationMock,
  startBirthdayBotMock,
  getContactConversationsMock,
  getContactByPhoneMock,
  getChatMock,
  dbSelectResults,
  syncContactMock,
  createChatMock,
  getContactsMock,
  updateContactMock,
  deleteContactMock,
  getContactTagsMock,
  getTagsMock,
  getChatByIdMock,
  sendMessageMock,
  getCashbackFieldMock,
  getBotCashbackMock,
  createCashbackMock,
  updateCashbackMock,
  createCampaignControllerMock,
  listCampaignsControllerMock,
  getCampaignDetailsControllerMock,
  getCampaignStatsControllerMock,
} = vi.hoisted(() => ({
  getChannelsMock: vi.fn(),
  getBotMock: vi.fn(),
  getManualStartsBotMock: vi.fn(),
  getBotsMock: vi.fn(),
  getBirthdayBotsMock: vi.fn(),
  getBirthdayTodayBotsAutomationMock: vi.fn(),
  getBirthdayDaysBeforeBotAutomationMock: vi.fn(),
  startBirthdayBotMock: vi.fn(),
  getContactConversationsMock: vi.fn(),
  getContactByPhoneMock: vi.fn(),
  getChatMock: vi.fn(),
  dbSelectResults: [] as unknown[][],
  syncContactMock: vi.fn(),
  createChatMock: vi.fn(),
  getContactsMock: vi.fn(),
  updateContactMock: vi.fn(),
  deleteContactMock: vi.fn(),
  getContactTagsMock: vi.fn(),
  getTagsMock: vi.fn(),
  getChatByIdMock: vi.fn(),
  sendMessageMock: vi.fn(),
  getCashbackFieldMock: vi.fn(),
  getBotCashbackMock: vi.fn(),
  createCashbackMock: vi.fn(),
  updateCashbackMock: vi.fn(),
  createCampaignControllerMock: vi.fn(),
  listCampaignsControllerMock: vi.fn(),
  getCampaignDetailsControllerMock: vi.fn(),
  getCampaignStatsControllerMock: vi.fn(),
}));

vi.mock("../../integrations/umbler", () => ({
  getChannels: getChannelsMock,
  getBot: getBotMock,
  getManualStartsBot: getManualStartsBotMock,
  getBots: getBotsMock,
  getBirthdayBots: getBirthdayBotsMock,
  getBirthdayTodayBotsAutomation: getBirthdayTodayBotsAutomationMock,
  getBirthdayDaysBeforeBotAutomation: getBirthdayDaysBeforeBotAutomationMock,
  startBirthdayBot: startBirthdayBotMock,
  getContactConversations: getContactConversationsMock,
  getContactByPhone: getContactByPhoneMock,
  getChat: getChatMock,
  syncContact: syncContactMock,
  createContactSchema: {
    parse: vi.fn((value: unknown) => value),
  },
  createChat: createChatMock,
  getContacts: getContactsMock,
  updateContact: updateContactMock,
  deleteContact: deleteContactMock,
  getContactTags: getContactTagsMock,
  getTags: getTagsMock,
  getChatById: getChatByIdMock,
  sendMessage: sendMessageMock,
  getCashbackField: getCashbackFieldMock,
  getBotCashback: getBotCashbackMock,
  createCashback: createCashbackMock,
  updateCashback: updateCashbackMock,
}));

vi.mock("../../controllers/campaigns/create-campaign.controller", () => ({
  createCampaignController: createCampaignControllerMock,
}));
vi.mock("../../controllers/campaigns/list-campaigns.controller", () => ({
  listCampaignsController: listCampaignsControllerMock,
}));
vi.mock("../../controllers/campaigns/get-campaign-details.controller", () => ({
  getCampaignDetailsController: getCampaignDetailsControllerMock,
}));
vi.mock("../../controllers/campaigns/get-campaign-stats.controller", () => ({
  getCampaignStatsController: getCampaignStatsControllerMock,
}));

vi.mock("../../db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            leftJoin: vi.fn(async () => dbSelectResults.shift() ?? []),
          })),
        })),
      })),
      where: vi.fn(async () => dbSelectResults.shift() ?? []),
    })),
  },
}));

describe("umblerRouter simple endpoints", () => {
  beforeEach(() => {
    getChannelsMock.mockReset();
    getBotMock.mockReset();
    getManualStartsBotMock.mockReset();
    getBotsMock.mockReset();
    getBirthdayBotsMock.mockReset();
    getBirthdayTodayBotsAutomationMock.mockReset();
    getBirthdayDaysBeforeBotAutomationMock.mockReset();
    startBirthdayBotMock.mockReset();
    getContactConversationsMock.mockReset();
    getContactByPhoneMock.mockReset();
    getChatMock.mockReset();
    dbSelectResults.length = 0;
    syncContactMock.mockReset();
    createChatMock.mockReset();
    getContactsMock.mockReset();
    updateContactMock.mockReset();
    deleteContactMock.mockReset();
    getContactTagsMock.mockReset();
    getTagsMock.mockReset();
    getChatByIdMock.mockReset();
    sendMessageMock.mockReset();
    getCashbackFieldMock.mockReset();
    getBotCashbackMock.mockReset();
    createCashbackMock.mockReset();
    updateCashbackMock.mockReset();
    createCampaignControllerMock.mockReset();
    listCampaignsControllerMock.mockReset();
    getCampaignDetailsControllerMock.mockReset();
    getCampaignStatsControllerMock.mockReset();

    createCampaignControllerMock.mockImplementation((_req, res) => {
      res.status(201).json({ route: "create-campaign" });
    });
    listCampaignsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "list-campaigns" });
    });
    getCampaignDetailsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "campaign-details" });
    });
    getCampaignStatsControllerMock.mockImplementation((_req, res) => {
      res.status(200).json({ route: "campaign-stats" });
    });
  });

  it("keeps both channel URLs returning the same payload", async () => {
    getChannelsMock.mockResolvedValue([{ id: "channel-1" }]);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const [defaultResponse, aliasResponse] = await Promise.all([
      request(app).get("/umbler/channels"),
      request(app).get("/umbler/whatsapp-api/channels"),
    ]);

    expect(getChannelsMock).toHaveBeenCalledTimes(2);
    expect(defaultResponse.status).toBe(200);
    expect(aliasResponse.status).toBe(200);
    expect(defaultResponse.body).toEqual([{ id: "channel-1" }]);
    expect(aliasResponse.body).toEqual([{ id: "channel-1" }]);
  });

  it("wraps GET /umbler/bot as { result: items }", async () => {
    getBotMock.mockResolvedValue({ items: [{ id: "bot-1" }] });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/bot?title=welcome");

    expect(getBotMock).toHaveBeenCalledWith("welcome");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: [{ id: "bot-1" }] });
  });

  it("returns 500 when manual-starts bot returns null", async () => {
    getManualStartsBotMock.mockResolvedValue(null);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/manual-starts/bot?query=promo");

    expect(getManualStartsBotMock).toHaveBeenCalledWith("promo");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Erro ao buscar bots",
      error: "API retornou null",
    });
  });

  it("uses default pagination for GET /umbler/bots", async () => {
    getBotsMock.mockResolvedValue({ items: [] });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/bots?query=test&hidden=true");

    expect(getBotsMock).toHaveBeenCalledWith("test", 0, 34);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it("keeps birthday endpoints response shapes", async () => {
    getBirthdayBotsMock.mockResolvedValue({ items: [{ id: "birthday-1" }] });
    getBirthdayTodayBotsAutomationMock.mockResolvedValue(undefined);
    getBirthdayDaysBeforeBotAutomationMock.mockResolvedValue(undefined);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const [allBots, todayBots, daysBeforeBots] = await Promise.all([
      request(app).get("/umbler/birthday-bots"),
      request(app).get("/umbler/birthday-bots-today"),
      request(app).get("/umbler/birthday-bots-days-before"),
    ]);

    expect(allBots.body).toEqual({ items: [{ id: "birthday-1" }] });
    expect(todayBots.body).toEqual({ items: [] });
    expect(daysBeforeBots.body).toEqual({ items: [] });
  });

  it("preserves POST /start/birthday-bot outside /umbler path", async () => {
    startBirthdayBotMock.mockResolvedValue({ executionId: "exec-1" });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).post("/start/birthday-bot").send({
      botId: "bot-1",
      chatId: "chat-1",
      triggerName: "birthday",
    });

    expect(startBirthdayBotMock).toHaveBeenCalledWith({
      botId: "bot-1",
      chatId: "chat-1",
      triggerName: "birthday",
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Bot de aniversário iniciado com sucesso",
      result: { executionId: "exec-1" },
    });
  });

  it("keeps /umbler/contacts/conversations before /contacts/:phone", async () => {
    getContactConversationsMock.mockResolvedValue([{ id: "conversation-1" }]);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get(
      "/umbler/contacts/conversations?phoneNumber=5511999999999&channelId=channel-1",
    );

    expect(getContactConversationsMock).toHaveBeenCalledWith(
      "5511999999999",
      "channel-1",
    );
    expect(getContactByPhoneMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "conversation-1" }]);
  });

  it("returns 404 for GET /umbler/contacts/:phone when contact is missing", async () => {
    getContactByPhoneMock.mockResolvedValue(null);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/contacts/5511999999999");

    expect(getContactByPhoneMock).toHaveBeenCalledWith("5511999999999");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Contato não encontrado" });
  });

  it("returns 404 for GET /umbler/chats when user is missing", async () => {
    dbSelectResults.push([]);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get(
      "/umbler/chats?customerPhone=5511999999999&userId=user-1",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Usuário não encontrado" });
  });

  it("creates contact and chat in POST /umbler/contacts/create", async () => {
    dbSelectResults.push([{ id: "user-1", channelId: "channel-1" }]);
    syncContactMock.mockResolvedValue({ contact: { id: "contact-1" } });
    createChatMock.mockResolvedValue({ id: "chat-1" });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app)
      .post("/umbler/contacts/create?userId=user-1")
      .send({ phoneNumber: "5511999999999", organizationId: "org-1" });

    expect(syncContactMock).toHaveBeenCalled();
    expect(createChatMock).toHaveBeenCalledWith({
      channelId: "channel-1",
      contactId: "contact-1",
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Contato sincronizado com sucesso",
      newChat: { id: "chat-1" },
    });
  });

  it("normalizes tags and booleans in GET /umbler/contacts", async () => {
    getContactsMock.mockResolvedValue({ items: [] });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get(
      "/umbler/contacts?query=ana&tags=tag-1&tags=tag-2&exclusiveTag=true&fetchAll=true",
    );

    expect(getContactsMock).toHaveBeenCalledWith(
      "ana",
      ["tag-1", "tag-2"],
      true,
      true,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it("returns filtered tags in GET /umbler/tags", async () => {
    getTagsMock.mockResolvedValue({
      items: [
        { id: "1", name: "VIP" },
        { id: "2", name: "Comercial" },
      ],
    });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/tags?query=vip");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [{ id: "1", name: "VIP" }] });
  });

  it("returns 502 when POST /umbler/chats gets no confirmation", async () => {
    dbSelectResults.push([{ id: "user-1", channelId: "channel-1" }]);
    createChatMock.mockResolvedValue(null);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).post("/umbler/chats").send({
      userId: "user-1",
      contactId: "contact-1",
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      message: "O Umbler não confirmou a solicitação de criação do chat",
    });
  });

  it("returns 201 for POST /umbler/messages", async () => {
    sendMessageMock.mockResolvedValue({ id: "message-1" });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).post("/umbler/messages").send({
      chatId: "chat-1",
      message: "Oi",
    });

    expect(sendMessageMock).toHaveBeenCalledWith({
      chatId: "chat-1",
      message: "Oi",
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Mensagem enviada com sucesso",
      result: { id: "message-1" },
    });
  });

  it("filters cashback field by custom definition id", async () => {
    getCashbackFieldMock.mockResolvedValue([
      { customFieldDefinitionId: "other", value: "1" },
      { customFieldDefinitionId: "aIpL5QxBcwmaXxEo", value: "50" },
    ]);
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/contact-1/cashback-field");

    expect(getCashbackFieldMock).toHaveBeenCalledWith("contact-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      result: { customFieldDefinitionId: "aIpL5QxBcwmaXxEo", value: "50" },
    });
  });

  it("returns bot-cashback payload", async () => {
    getBotCashbackMock.mockResolvedValue({ bot: { id: "bot-cashback" } });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).get("/umbler/bot-cashback");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: { id: "bot-cashback" } });
  });

  it("creates cashback preserving body contract", async () => {
    createCashbackMock.mockResolvedValue({ id: "cashback-1" });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).post("/umbler/cashback").send({
      contactId: "contact-1",
      value: "12.50",
    });

    expect(createCashbackMock).toHaveBeenCalledWith({
      contactId: "contact-1",
      value: "12.50",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "cashback-1" });
  });

  it("updates cashback mapping cashbackId to customFieldId", async () => {
    updateCashbackMock.mockResolvedValue({ ok: true });
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).put("/umbler/cashback/field-1").send({
      contactId: "contact-1",
      value: "25.00",
    });

    expect(updateCashbackMock).toHaveBeenCalledWith({
      contactId: "contact-1",
      customFieldId: "field-1",
      value: "25.00",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("delegates campaign routes to statically imported controllers", async () => {
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const [createResponse, listResponse, detailsResponse, statsResponse] = await Promise.all([
      request(app).post("/umbler/campaigns").send({ title: "Campanha" }),
      request(app).get("/umbler/campaigns"),
      request(app).get("/umbler/campaigns/campaign-1"),
      request(app).get("/umbler/campaigns/campaign-1/stats"),
    ]);

    expect(createCampaignControllerMock).toHaveBeenCalledTimes(1);
    expect(listCampaignsControllerMock).toHaveBeenCalledTimes(1);
    expect(getCampaignDetailsControllerMock).toHaveBeenCalledTimes(1);
    expect(getCampaignStatsControllerMock).toHaveBeenCalledTimes(1);
    expect(createResponse.body).toEqual({ route: "create-campaign" });
    expect(listResponse.body).toEqual({ route: "list-campaigns" });
    expect(detailsResponse.body).toEqual({ route: "campaign-details" });
    expect(statsResponse.body).toEqual({ route: "campaign-stats" });
  });

  it("keeps POST /client/umbler/tag response shape", async () => {
    const app = createRouteTestApp({ router: umblerRouter, basePath: "/" });

    const response = await request(app).post("/client/umbler/tag").send({
      event: "tag-added",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
  });
});
