import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { messageAutomationSettingsRouter } from "../message-automation-settings.routes";

const {
  createControllerMock,
  getControllerMock,
  updateControllerMock,
  deleteControllerMock,
} = vi.hoisted(() => ({
  createControllerMock: vi.fn(),
  getControllerMock: vi.fn(),
  updateControllerMock: vi.fn(),
  deleteControllerMock: vi.fn(),
}));

vi.mock("../../controllers/create-message-automation-settings.controller", () => ({
  createMessageAutomationSettingsController: createControllerMock,
}));
vi.mock("../../controllers/get-message-automation-settings.controller", () => ({
  getMessageAutomationSettingsController: getControllerMock,
}));
vi.mock("../../controllers/update-message-automation-settings.controller", () => ({
  updateMessageAutomationSettingsController: updateControllerMock,
}));
vi.mock("../../controllers/delete-message-automation-settings.controller", () => ({
  deleteMessageAutomationSettingsController: deleteControllerMock,
}));

describe("messageAutomationSettingsRouter", () => {
  beforeEach(() => {
    createControllerMock.mockReset();
    getControllerMock.mockReset();
    updateControllerMock.mockReset();
    deleteControllerMock.mockReset();

    createControllerMock.mockImplementation((_req, res) => res.status(201).json({ route: "create" }));
    getControllerMock.mockImplementation((_req, res) => res.status(200).json([{ route: "get" }]));
    updateControllerMock.mockImplementation((_req, res) => res.status(200).json({ route: "update" }));
    deleteControllerMock.mockImplementation((_req, res) => res.status(200).json({ route: "delete" }));
  });

  it("keeps GET /message-automation-settings", async () => {
    const app = createRouteTestApp({ router: messageAutomationSettingsRouter, basePath: "/message-automation-settings" });
    const response = await request(app).get("/message-automation-settings");

    expect(getControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("keeps POST /message-automation-settings", async () => {
    const app = createRouteTestApp({ router: messageAutomationSettingsRouter, basePath: "/message-automation-settings" });
    const response = await request(app).post("/message-automation-settings").send({ enabled: true });

    expect(createControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
  });

  it("keeps PUT /message-automation-settings/:id", async () => {
    const app = createRouteTestApp({ router: messageAutomationSettingsRouter, basePath: "/message-automation-settings" });
    const response = await request(app).put("/message-automation-settings/setting-1").send({ enabled: false });

    expect(updateControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("keeps DELETE /message-automation-settings/:id", async () => {
    const app = createRouteTestApp({ router: messageAutomationSettingsRouter, basePath: "/message-automation-settings" });
    const response = await request(app).delete("/message-automation-settings/setting-1");

    expect(deleteControllerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });
});
