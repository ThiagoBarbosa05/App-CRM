import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAuthMiddleware, createRouteTestApp } from "../../test/create-route-test-app";

vi.mock("../../db", () => ({ db: {}, pool: {} }));

const { listBotsMock, filterBotsForChannelMock } = vi.hoisted(() => ({
  listBotsMock: vi.fn(),
  filterBotsForChannelMock: vi.fn(),
}));

vi.mock("../../services/whatsapp-bot.service", () => ({
  listBots: listBotsMock,
  getBot: vi.fn(),
  createBot: vi.fn(),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  duplicateBot: vi.fn(),
  saveFlow: vi.fn(),
}));
vi.mock("../../services/whatsapp-bot-compatibility.service", () => ({
  analyzeBotCompatibility: vi.fn(),
  filterBotsForChannel: filterBotsForChannelMock,
}));
vi.mock("../../services/whatsapp-channels.service", () => ({
  listChannelIdsForUser: vi.fn(),
}));
vi.mock("../../lib/r2", () => ({ r2: { send: vi.fn() } }));

import botsRouter from "../whatsapp-bots.routes";

describe("GET /bots com canal da conversa", () => {
  beforeEach(() => {
    listBotsMock.mockReset().mockResolvedValue([
      { id: "plain", name: "Bot simples" },
      { id: "meta", name: "Bot Meta" },
    ]);
    filterBotsForChannelMock.mockReset().mockResolvedValue([
      { id: "plain", name: "Bot simples" },
    ]);
  });

  it("repassa channelId ao filtro de bots manuais", async () => {
    const app = createRouteTestApp({
      router: botsRouter,
      basePath: "/api/whatsapp",
      middlewares: [createMockAuthMiddleware({ userId: "u1", role: "vendedor" })],
    });

    const response = await request(app).get(
      "/api/whatsapp/bots?activeOnly=true&manualOnly=true&channelId=17",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "plain", name: "Bot simples" }]);
  });
});
