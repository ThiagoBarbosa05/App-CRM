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
} = vi.hoisted(() => ({
  getChannelsMock: vi.fn(),
  getBotMock: vi.fn(),
  getManualStartsBotMock: vi.fn(),
  getBotsMock: vi.fn(),
  getBirthdayBotsMock: vi.fn(),
  getBirthdayTodayBotsAutomationMock: vi.fn(),
  getBirthdayDaysBeforeBotAutomationMock: vi.fn(),
  startBirthdayBotMock: vi.fn(),
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
});
